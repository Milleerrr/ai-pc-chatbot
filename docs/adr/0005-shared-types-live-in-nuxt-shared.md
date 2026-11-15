# Types used by client and server live in Nuxt's `shared/types/`

The client and the server each declared the chat types by hand. `ChatSummary` was in both `server/services/Chat` and `app/queries/chats.ts`. `ChatMessage` was in both `server/services/Message` and `app/queries/chats.ts`. The created-chat shape was a type alias in `app/queries/chats.ts` and an inline type on `ChatService.create()`. Nothing kept the copies in step. A column added to a summary on the server would compile on both sides, and the client's type would just be wrong. Every later ticket that adds a tRPC procedure (rename, archive, the Build Brief, Allowance) would add another pair. So a type that both sides use is declared once, in Nuxt 4's `shared/` folder, which exists for code used by both `app/` and `server/`.

## Where types go

- **Used by both client and server:** `shared/types/<domain>.ts` (for example, `shared/types/chat.ts`). The server's service methods are annotated with these types, and the client's query layer and composables read them.
- **Database rows and enums:** stay in `shared/db/schema` (`Select*`, `Insert*`, enum unions). They describe tables, not what the API returns.
- **Owned by one module:** declared in the module that defines it, and anything else that needs it imports it from there. For example, `ChatsApi` and `StartChatDeps` belong to `app/queries/chats.ts`, the module whose factories take them. `useChatsApi` and the unit test import `ChatsApi` from there.
- **Client types no single module owns:** `app/types/<domain>.ts`.
- **Server domain types used by several files:** `server/services/<Domain>/types.ts`, next to the service at `server/services/<Domain>/index.ts`. This mirrors platform's `services/<Domain>/types.ts`. Cross-service plumbing (`RequestContext`) stays in `server/services/types.ts`.

Don't create these folders and files ahead of need.

## Imports

Import shared types explicitly, with `import type { ChatSummary } from "#shared/types/chat"`. Don't rely on Nuxt's auto-import of `shared/types`. The `unit` and `integration` Vitest projects run in plain Node without Nuxt, and the repo uses explicit imports elsewhere. Use the top-level `import type { … }` form, which is removed at compile time, so Vitest never has to resolve the `#shared` alias. The inline form `import { type X }` is not safe in `app/`. Nuxt's app tsconfig sets `verbatimModuleSyntax`, so that import becomes a bare `import "#shared/…"` at runtime, and the `unit` project fails with "Cannot find module". The `@typescript-eslint/no-import-type-side-effects` rule (on through `@nuxt/eslint`) flags that form, and `eslint --fix` rewrites it to `import type`. A future runtime value in `shared/utils` would need a `#shared` alias in `vitest.config.ts`. Files in `shared/types/` never import from `app/` or `server/`. The scripts in `shared/db/` (seeds, app role) run outside Nuxt and do import `server/db`. That is a separate, existing exception.

## Considered options

- **A top-level `common/` folder, as in platform (`packages/shared/src/common/types`).** Rejected. It would need its own alias, and it would sit next to Nuxt's `shared/`, which does the same job. We keep platform's split (shared shapes in one place, server domain types next to their service) under Nuxt's names.
- **Inferring client types from the router (`inferRouterOutputs<AppRouter>`).** Not chosen. The query factories take an injected `ChatsApi` so they run against a fake in the `unit` project, and that interface reads better with named domain types than with indexed router outputs. Annotating service return types with the shared types means the server can't drift from them either. This could be revisited if the shared types become pure duplicates of procedure outputs.
- **Nuxt auto-imports for `shared/types`.** Rejected, for the Vitest and explicit-import reasons above.

## Consequences

- `ChatSummary`, `ChatMessage` and `CreatedChat` are defined once, in `shared/types/chat.ts`. `ChatService.create()` returns `CreatedChat`.
- `nuxt.config.ts` adds `#shared` to `typescript.nodeTsConfig.compilerOptions.paths`. Test files are linted through `tsconfig.eslint.json`, which extends the generated `tsconfig.node.json`, and that config doesn't include the alias by default. Overriding `paths` in `tsconfig.eslint.json` itself would replace the generated, machine-specific paths, so the alias goes through Nuxt's config instead.
- Code in `shared/types` can only use packages that are safe on both sides, such as `ai`'s `UIMessage`. It must never import server-only modules (database, auth) or Vue.
