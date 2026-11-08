# How do Guest Chats move to a real account on sign-in?

Research for [#5](https://github.com/Milleerrr/ai-pc-chatbot/issues/5), part of the Chat v1 map ([#1](https://github.com/Milleerrr/ai-pc-chatbot/issues/1)). Researched 2026-11-08 against `better-auth@1.7.18`, the version pinned in `pnpm-lock.yaml` and installed in `node_modules/better-auth/package.json`.

Sources used:

- Better Auth docs, anonymous plugin: https://www.better-auth.com/docs/plugins/anonymous
- Better Auth source at tag `v1.7.18`:
  - [`plugins/anonymous/index.ts`](https://github.com/better-auth/better-auth/blob/v1.7.18/packages/better-auth/src/plugins/anonymous/index.ts) (also read as built output in `node_modules/better-auth/dist/plugins/anonymous/index.mjs` and `types.d.mts`)
  - [`api/dispatch.ts`](https://github.com/better-auth/better-auth/blob/v1.7.18/packages/better-auth/src/api/dispatch.ts) (hook pipeline)
  - [`db/internal-adapter.ts`](https://github.com/better-auth/better-auth/blob/v1.7.18/packages/better-auth/src/db/internal-adapter.ts) (`deleteUser`)
- PostgreSQL docs: [Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- This repo: `AGENTS.md`, `CONTEXT.md`, `server/auth/create-auth.ts`, `server/auth/index.ts`, `server/db/connection.ts`, `server/db/with-user.ts`, `shared/db/rls.ts`, `shared/db/schema/auth.ts`, `shared/db/app-role/index.ts`, `server/trpc/init.ts`, `app/composables/useEnsureSession.ts`, `test/integration/rls.test.ts`

## Short answer

- **`onLinkAccount`** gets `{ anonymousUser: { user, session }, newUser: { user, session }, ctx }`, so it has both the old (Guest) and new user ids. It runs in an **after hook**, once the sign-in or sign-up endpoint has finished and its own transaction has committed. Better Auth opens **no transaction** around it. If we need one, we open it ourselves.
- **The anonymous user is deleted by default**, right after `onLinkAccount` returns, through `internalAdapter.deleteUser` (sessions, then accounts, then the user row). Any of our tables with `ON DELETE CASCADE` to `user` would lose whatever is still owned by the Guest at that moment. Because the delete only happens after `onLinkAccount` has finished, rows moved inside the callback are safe. If the callback throws, the delete is skipped. If the delete itself fails, Better Auth logs the error and carries on.
- **Which connection:** `app_user` can't do the move. The `owner_isolation` policy uses the same expression for `USING` and `WITH CHECK`, so no single `app.user_id` lets an UPDATE both see the Guest's row and write the new owner. The workable path is the connection Better Auth already holds: `createAuth` receives `deps.db`, which is `unrestrictedDb()` (`server/auth/index.ts`). We pass it into a service from inside `onLinkAccount`. This is Better Auth hook code, so it fits "`unrestrictedDb()` is for Better Auth only", but RLS no longer guards those queries. Every statement must filter on the Guest id explicitly. Record this in an ADR.
- **Existing account:** if a Guest signs in to an account that already exists, the same hook fires with `newUser` set to that account. The Guest's Builds, Chats and Messages are added to the account's own. Since in v1 each Chat makes its own Build, there is nothing to merge and no key to collide on. Watch for per-user singletons and daily-cap counters.

## 1. What `onLinkAccount` provides and when it runs

### Signature

From `AnonymousOptions` in `node_modules/better-auth/dist/plugins/anonymous/types.d.mts`:

```ts
onLinkAccount?: (data: {
  anonymousUser: { user: UserWithAnonymous & Record<string, any>; session: Session & Record<string, any> };
  newUser:       { user: User & Record<string, any>;              session: Session & Record<string, any> };
  ctx: GenericEndpointContext;
}) => Awaitable<void>;
```

- Old id is `anonymousUser.user.id` and new id is `newUser.user.id`. Both come from Better Auth's own session lookups, not from request input (`index.ts`, `resolveAnonymousSession` and `ctx.context.newSession`).
- `ctx` is the Better Auth endpoint context (`ctx.context.adapter`, `ctx.context.logger`, `ctx.path`, and so on).
- The docs' only guidance is the example comment "perform actions like moving the cart items from anonymous user to the new user" (https://www.better-auth.com/docs/plugins/anonymous).

### When it fires

The plugin registers an `after` hook (`index.ts`, `hooks.after`, around lines 336 to 430 at v1.7.18):

1. **Matcher.** The path starts with `/sign-in`, `/sign-up`, `/callback`, `/magic-link/verify`, `/email-otp/verify-email`, `/one-tap/callback`, `/passkey/verify-authentication`, `/phone-number/verify` or `/verify-email`. That covers this repo's email/password sign-in, email sign-up, and the Google OAuth callback (`server/auth/create-auth.ts` enables `emailAndPassword` and `socialProviders.google`).
2. The response must set a session cookie. Otherwise it returns. An email sign-up that waits for verification therefore doesn't link. This repo doesn't set `requireEmailVerification` (`server/auth/create-auth.ts`).
3. `resolveAnonymousSession(ctx)` reads the current session cookie and needs `user.isAnonymous`. For OAuth, a `before` hook on `/sign-in/social` stores `anonymousUserId` in the server-side OAuth state (`addOAuthServerContext`), and the callback falls back to it when the cookie is missing. With no live anonymous session, it returns: **no link**.
4. `ctx.context.newSession` must exist. It is set by `setSessionCookie` (`node_modules/better-auth/dist/cookies/index.mjs`).
5. If the two-factor plugin wants a second factor, it returns without linking and keeps the anonymous user. The docs confirm this: "`onLinkAccount` is not called and the anonymous user is kept" (https://www.better-auth.com/docs/plugins/anonymous). Two-factor isn't installed here.
6. `await options.onLinkAccount({ anonymousUser, newUser: newSession, ctx })`.
7. Then the delete step (section 2).

### Timing and transactions

- After hooks run in `runAfterHooks` (`api/dispatch.ts`), which `dispatchAuthEndpoint` calls only after `await endpoint(internalContext)` has resolved.
- Endpoints that use a transaction scope it to the handler body. Sign-up wraps its handler in `runWithTransaction` (`node_modules/better-auth/dist/api/routes/sign-up.mjs`), and the OAuth user and account creation does the same (`node_modules/better-auth/dist/oauth2/link-account.mjs`). By the time `onLinkAccount` runs, the new user and session are **already committed**.
- Nothing wraps the after hook in `runWithTransaction` (`index.ts`, `api/dispatch.ts`). `onLinkAccount` runs outside any Better Auth transaction, and the later `deleteUser` is a separate set of statements.
- It runs on the Better Auth HTTP route (`server/api/auth/[...all].ts` calls `getAuth().handler`), not inside tRPC, so `baseProcedure`/`withUser()` scoping doesn't apply (`server/trpc/init.ts`).

### If `onLinkAccount` throws

- `runAfterHooks` turns an `APIError` into the response and rethrows anything else (`api/dispatch.ts`). Either way the client sees an error, even though the new user and session already exist in the database (step "Timing" above).
- The throw ends the hook before the delete step, so **the anonymous user and its data survive** (`index.ts`: deletion comes after the `await options.onLinkAccount(...)` line).
- So a failed move leaves the Guest's rows under an anonymous user nobody may hold a session for. Make the move one transaction so it's all or nothing, and log enough (both ids) to re-run it.

## 2. Is the anonymous user deleted, and what cascades?

### The delete

After `onLinkAccount` (`index.ts`, around lines 413 to 430 at v1.7.18):

```ts
const isSameUser = newSessionUser?.id === session.user.id;
const newSessionIsAnonymous = Boolean(newSessionUser?.isAnonymous);
if (options?.disableDeleteAnonymousUser || isSameUser || newSessionIsAnonymous) return;
try {
  await ctx.context.internalAdapter.deleteUser(session.user.id);
} catch (error) {
  ctx.context.logger.error("Failed to clean up anonymous user during post-link cleanup", { anonymousUserId: session.user.id, error });
}
```

- The delete is on by default. The docs say "the `anonymousUser` will be deleted by default" (https://www.better-auth.com/docs/plugins/anonymous).
- A failed delete is **logged and swallowed**. Sign-in still succeeds.
- `disableDeleteAnonymousUser: true` turns off the automatic delete. It also blocks the `/delete-anonymous-user` endpoint for anonymous users (docs, and the `deleteAnonymousUser` endpoint in `index.ts`).

`internalAdapter.deleteUser(userId)` (`db/internal-adapter.ts`, `deleteUser`, line 499 at v1.7.18) deletes, in order:

1. `session` rows for the user (when sessions are stored in the database, which is the case here because no `secondaryStorage` is configured in `server/auth/create-auth.ts`)
2. `account` rows for the user
3. the `user` row

It runs through `deleteManyWithHooks`/`deleteWithHooks`, so `databaseHooks.user.delete.before/after` would fire if we configured them. All of this goes through the Drizzle adapter on `unrestrictedDb()` (`server/auth/index.ts`), so RLS is not involved (table owners bypass RLS: [Postgres docs](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)).

### What cascades

- Today, only `session.userId` and `account.userId` reference `user`, both `onDelete: "cascade"` (`shared/db/schema/auth.ts`). No app tables exist yet (`shared/db/schema/` has only `auth.ts`).
- Builds, Chats and Messages will each carry their own `userId` (`AGENTS.md`, Row-level security convention). If those columns reference `user.id`:
  - **`ON DELETE CASCADE`:** whatever still belongs to the Guest when `deleteUser` runs is wiped. Rows moved in `onLinkAccount` are safe, because the delete only runs after the callback returns, and only if it didn't throw. Data is lost only if the callback misses a table, or fires off work it doesn't `await`.
  - **`ON DELETE RESTRICT` / `NO ACTION`:** a missed table makes `deleteUser` fail, Better Auth swallows the error, and the Guest row and its leftover data stay put. That's a safer net, but it leaves orphaned Guest users behind and makes any later Guest clean-up job delete children first.
- Foreign key actions ignore RLS: "Referential integrity checks ... always bypass row security" ([Postgres docs](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)). A cascade takes every child row, whatever the policies say.

### An option that makes the cascade question moot

Set `anonymous({ disableDeleteAnonymousUser: true, onLinkAccount })`. In `onLinkAccount`, reassign every table **and** delete the Guest `user` row in **one** transaction. `session`/`account` then cascade from `user` (`shared/db/schema/auth.ts`). Either everything moves and the Guest is gone, or nothing changes. Trade-offs:

- It bypasses Better Auth's `deleteWithHooks`, so no `databaseHooks.user.delete` would fire. None are configured.
- It skips the cached-session clean-up in `deleteUser`. That only matters with `secondaryStorage`, which isn't configured.
- It loses the `/delete-anonymous-user` endpoint for Guests. Nothing in the repo uses it.

## 3. Which DB connection can do the reassignment

### Not `app_user` through `withUser()`

- `ownerPolicy` uses `ownsRow(userIdColumn)` for **both** `using` and `withCheck`: `userId = current_setting('app.user_id')` (`shared/db/rls.ts`).
- Moving a row means `UPDATE ... SET user_id = :new WHERE user_id = :guest`. `USING` needs the existing row's `user_id` to equal `app.user_id` (the Guest). `WITH CHECK` needs the new row's `user_id` to equal `app.user_id` (the new user). With one setting, one side always fails. Scoped as the Guest, the update errors on `WITH CHECK`. A failing `WITH CHECK` on UPDATE raises an error rather than skipping the row ([CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html)). Scoped as the new user, the update matches zero rows, the same "silently blocks cross-user writes" behaviour `test/integration/rls.test.ts` checks.
- Workarounds on `app_user` all add machinery:
  - Copy then delete, switching `app.user_id` between statements in one transaction. Ids would have to be reused after the delete, and parent and child order (Build, Chat, Message) is fiddly.
  - A second setting, such as `app.previous_user_id`, plus a reassignment policy in `shared/db/rls.ts`.
  - A `SECURITY DEFINER` function, which would need hand-written SQL that `AGENTS.md` forbids in migrations.
- Besides, `onLinkAccount` runs on the Better Auth route with no verified tRPC context. `withUser()` would be fed ids from the Better Auth hook, which is acceptable under its "only pass a context from a verified Better Auth session" rule (`server/db/with-user.ts`), but it still can't satisfy the policy.

### Recommended: the Better Auth connection, inside the Better Auth hook

- `getAuth()` already builds Better Auth with `db: unrestrictedDb()` (`server/auth/index.ts`). `createAuth(deps)` has it as `deps.db` (`server/auth/create-auth.ts`). The callback is part of the Better Auth configuration, which is exactly the job `server/db/connection.ts` gives this connection ("Only for Better Auth"). Use `deps.db` rather than calling `unrestrictedDb()` somewhere new.
- To keep `AGENTS.md`'s "data access goes through a service", have `onLinkAccount` call a service built with `createService({ db: deps.db })` (`server/services/createService.ts`), for example a Guest migration service. The service opens one transaction and runs `UPDATE <table> SET user_id = :new WHERE user_id = :guest` for every user-owned table (Builds, Chats, Messages, plus any later ones). Optionally it also deletes the Guest user (section 2).
- Guard rails, since RLS is off on this connection:
  - Every statement filters on the Guest id explicitly.
  - Both ids come only from the hook arguments.
  - Check `anonymousUser.user.isAnonymous` and `newUser.user.id !== anonymousUser.user.id` before moving anything. The plugin also skips the delete in those cases (`index.ts`).
  - Add an integration test that a Guest's rows end up owned by the new user and stay invisible to a third user. That sits naturally next to `test/integration/rls.test.ts`.
- This bends the spirit of `AGENTS.md` ("Don't reach for `unrestrictedDb()` to get around a policy"), so record it in an ADR under `docs/adr/`. The reasoning: Guest-to-account reassignment is an auth-time ownership change that RLS can't express, it runs only in the Better Auth hook, and nothing on the request path uses this connection.

## 4. Edge case: a Guest signs in to an account that already has Builds

- **The hook fires the same way.** Email/password sign-in to an existing account goes to `/sign-in/email`, and Google sign-in for an existing user goes to `/callback/google`. Both match the hook and set a new session cookie, so `onLinkAccount` runs with `newUser.user` set to the **existing** account. `isSameUser` is false, so the Guest is then deleted (`index.ts`, section 1 matcher and section 2 snippet). Better Auth draws no distinction between "new account" and "existing account" here.
- **There's nothing to merge.** In v1 each new Chat creates a new Build, and Continuations inherit it (map #1, "Already settled"). Builds have no per-user unique key, so `SET user_id = :existing` just adds the Guest's Builds, Chats and Messages to the account's list. No conflict resolution is needed, as long as these tables carry no per-user unique constraints.
- Things to decide when the schema lands:
  - **Daily message caps.** Caps are lower for Guests (map #1). If today's usage is counted per `userId` from Messages or a counter row, merging can push the account over its cap at once, or a counter row can collide. Choose whether to sum, keep the account's count, or skip moved rows.
  - **Per-user singletons.** Settings, or the "facts that span Builds" idea (map #1, Not yet specified), would collide. Keep the existing account's values and drop or merge the Guest's.
  - **Shared devices.** Whoever signs in on that browser takes the Guest's Chats. That matches `CONTEXT.md` ("A Guest ... keeps them when they sign in"), so it's a product call, not a bug.
- **How often it happens here:**
  - `useEnsureSession` doesn't create a Guest when the browser has a `lastLoginMethod` cookie. It sends the user to `/login` instead (`app/composables/useEnsureSession.ts`, and the `lastLoginMethod` comment in `server/auth/create-auth.ts`).
  - "Guest signs in to an existing account" therefore mostly happens on a browser that has never signed in, or after that cookie is cleared, such as a new device.
- **A related gap: an expired Guest session.** If the anonymous session has expired before sign-in, `resolveAnonymousSession` finds no anonymous session, so nothing links and nothing is deleted (`index.ts`, step 3). The Guest's data stays with an unreachable anonymous user. That's acceptable for v1, but a later Guest clean-up job should expect it.

## Open questions for the PRD

1. Pick the delete strategy: Better Auth's default delete after the callback, or `disableDeleteAnonymousUser` plus our own delete in the same transaction. The second is atomic.
2. Pick the FK behaviour for `userId` on Builds, Chats and Messages: `cascade` or `restrict`.
3. Decide how daily-cap usage behaves when a Guest's Messages move to an account.
4. Write the ADR that allows the Better Auth connection for Guest reassignment.
