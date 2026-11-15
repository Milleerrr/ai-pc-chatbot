# Agent instructions

Nuxt 4 SPA (`ssr: false`) with tRPC, Drizzle, and Postgres. Package manager is pnpm. Extend the existing layout.

## Commands

- `pnpm install`
- `pnpm dev` — http://localhost:3000
- `pnpm db:up` / `pnpm db:down` — Postgres via Docker Compose
- `pnpm db:generate` then `pnpm db:migrate` — after schema changes (`db:migrate` also runs `db:app-role`)
- `pnpm db:app-role` — create/update the restricted `app_user` role and its grants (idempotent)
- `pnpm db:upgrade-check <base-ref>` — migrate and seed a scratch `upgrade_check` database with the code at `<base-ref>`, then apply the current migrations to it. Catches migrations that only work on an empty database (e.g. `pnpm db:upgrade-check main`)
- `pnpm db:seed` — development seed data
- `pnpm db:reset` — wipe the local DB (tables + migration history), then migrate and seed. Use after squashing migrations
- `pnpm db:reset:railway` — wipe the linked Railway DB and redeploy the app. Interactive, asks for the project name. Only for humans, never run it from an agent
- `pnpm build` — production check

- `pnpm test` — all Vitest projects (`unit`, `integration`, `e2e`, `nuxt`; layout follows the Nuxt testing guide under `test/`). `unit:test`, `integration:test`, `nuxt:test`, `e2e:test` run one project (e.g. `pnpm integration:test test/integration/rls.test.ts` for one file).
- `pnpm typecheck` — `nuxt typecheck`
- `pnpm lint` — ESLint, zero warnings. `pnpm knip` — unused files, exports, and dependencies

Integration tests run against `DATABASE_URL` (the normal dev DB locally, a service Postgres in CI). `resetDb` truncates every table, so run `pnpm db:seed` afterwards. The pre-commit hook runs `pnpm knip`, ESLint on staged files, and `pnpm unit:test`. Pull requests and pushes to `main` run `.github/workflows/ci.yml` (migration checks, lint, Knip, typecheck, and the full test suite). The migration checks fail if `shared/db/schema` has changes with no generated migration, if `drizzle-kit check` finds the migrations inconsistent, or if `pnpm db:upgrade-check` fails. That script builds an existing database from the code the target environment runs now (the PR's base branch, the previous `main`, or the `production` branch) and migrates it to the current code, so never rename, squash, or edit a migration that has already been deployed.

Railway deploys from GitHub itself; no workflow calls the Railway CLI. Staging follows `main` once CI passes, so a merge to `main` deploys staging. Production follows the `production` branch, which only `.github/workflows/release.yml` moves: publishing a GitHub release runs the checks, then fast-forwards `production` to the release commit. Railway's pre-deploy command runs `pnpm db:migrate` in each environment. Pull requests get a Railway PR environment.

## Layout

- `app/` — Nuxt UI. tRPC client is `app/plugins/trpc.ts`, Vue Query client is `app/plugins/vue-query.ts`. Server state: `app/queries/` (key and option factories). Client-only state: `app/reducers/` (pure), `app/effects/`, `app/stores/` (Pinia). Both are wrapped by composables.
- `server/trpc/` — context, middleware, routers. Procedures stay thin and call services.
- `server/api/trpc/[trpc].ts` — HTTP entry for tRPC.
- `server/db/` — Postgres connections and `withUser()`. Reads `dbCredentials` from private runtime config. `getDb()` is the RLS-enforced app connection; `unrestrictedDb()` bypasses RLS and is for Better Auth only.
- `server/services/` — business logic. Each domain is a folder, `server/services/<Domain>/index.ts`, whose class extends `Service` and is reached through `createService`.
- `shared/types/` — types used by both `app/` and `server/` (Nuxt's `#shared` alias).
- `shared/db/schema/` — Drizzle tables. Migrations in `shared/db/migrations/` are generated, never hand-written.
- `shared/db/seeds/` — seed data, run outside Nuxt.

## Conventions

- Data access goes through a service, then a tRPC procedure on `baseProcedure`. Do not query Drizzle from Vue pages.
- Server state (anything that mirrors the database: Chats, Messages, the Brief, Allowance) lives in TanStack Vue Query, never in a reducer or store. Each feature has `app/queries/<feature>.ts` with one key factory under a single root key plus query and mutation option factories over an injected API, unit-tested with a real `QueryClient`. A `use<Feature>` composable wires in tRPC and calls `useQuery`/`useMutation`. Mutations declare the keys they change in `meta: { invalidates: [...] }` (the client in `app/queries/client.ts` invalidates them on success); add an `onSuccess` only for navigation or a `setQueryData` the next screen needs. See `docs/adr/0004-server-state-lives-in-vue-query.md`.
- Client-only state changes go through reducers held in Pinia stores. A page or component never decides a state transition inline or calls tRPC from a handler: it dispatches an action through a `use<Feature>` composable, which is the only thing components import (never the raw store). A reducer is a pure `(state, action) => state` function in `app/reducers/` with no Vue, Pinia, Nuxt auto-imports, tRPC, clock or I/O, unit-tested in the `unit` project. Effects (tRPC calls, navigation) are async functions in `app/effects/` that take their dependencies and a `dispatch` callback and report back as actions (`started`, `succeeded`, `failed`, carrying a request id). The Pinia setup store in `app/stores/` holds the model and the only `dispatch`. Model status as a union, not booleans. The AI SDK chat hook keeps owning Message streaming state; reducers own the state around it (composer lock, banners, Brief badge, drawer, Setup Form, meter). A reducer may take query data or status as an action but never copies server data into its model. See `docs/adr/0003-client-state-changes-go-through-reducers.md`.
- Streaming procedures (assistant replies) use `streamProcedure`, not `baseProcedure`: `baseProcedure`'s transaction closes before a generator runs. Use short `withUser()` calls before and after the stream, never one held open across it, and abort the model call from `ctx.event.node.res.on('close')`. See `docs/adr/0002-streamed-replies-use-a-trpc-stream-procedure.md`.
- New tables use `baseTable` from `shared/db/utils.ts` and export `Insert*` / `Select*` types.
- Row-level security: user-owned tables get a `userId` column (indexed) and `ownerPolicy(table.userId)` from `shared/db/rls.ts`. Child tables (e.g. messages) carry their own `userId` rather than joining to the parent. Shared tables with no owner skip the policy and say so in a comment. Add a case to `test/integration/rls.test.ts`.
- The app queries as `app_user` (`APP_DATABASE_URL`), never the table owner. `baseProcedure` wraps each procedure in `withUser()`, so `ctx.db` and services are already scoped. Don't reach for `unrestrictedDb()` to get around a policy.
- `app_user` has no access to Better Auth's `session`, `account`, `verification` tables and can only update `name`/`image` on `user`. Change grants in `shared/db/app-role/index.ts`.
- Where types go: a type used by both client and server is declared once in `shared/types/<domain>.ts` and imported explicitly with `import type { … } from "#shared/types/<domain>"`, not through auto-imports. Database row types stay in `shared/db/schema`. A type owned by one module (e.g. `ChatsApi` in `app/queries/chats.ts`) is declared there, and other modules import it from there. A client type no single module owns goes in `app/types/<domain>.ts`. A server domain type used by several files goes in `server/services/<Domain>/types.ts`. Cross-service plumbing (`RequestContext`) stays in `server/services/types.ts`. Don't create these ahead of need. See `docs/adr/0005-shared-types-live-in-nuxt-shared.md`.
- Validate inputs with Zod. tRPC uses SuperJSON.
- Schema changes: edit `shared/db/schema`, then `pnpm db:generate` and `pnpm db:migrate`.
- `DATABASE_URL` and `APP_DATABASE_URL` are server-only, via private `runtimeConfig.dbCredentials`. Do not put it on `runtimeConfig.public`, hardcode credentials, or commit `.env`.

## Verification

Database up, migrate, seed, `pnpm dev`, then hit the affected tRPC procedure or page.

## Boundaries

- Do not commit `.env`, credentials, or edits to generated migrations.
- `plan.md` is a backlog, not current architecture. Do not add auth, logging, or AI-provider code unless that work is in scope.
- Do not restore deleted code without checking why it was removed.

## Agent skills

### Issue tracker

Issues and PRDs are GitHub Issues on `Milleerrr/ai-pc-chatbot`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default label names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and one `docs/adr/` at the repo root. See `docs/agents/domain.md`.
