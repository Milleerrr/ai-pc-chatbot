# Agent instructions

Nuxt 4 SPA (`ssr: false`) with tRPC, Drizzle, and Postgres. Package manager is pnpm. Extend the existing layout.

## Commands

- `pnpm install`
- `pnpm dev` — http://localhost:3000
- `pnpm db:up` / `pnpm db:down` — Postgres via Docker Compose
- `pnpm db:generate` then `pnpm db:migrate` — after schema changes
- `pnpm db:seed` — development seed data
- `pnpm build` — production check

- `pnpm test` — all Vitest projects (`unit`, `integration`, `e2e`, `nuxt`; layout follows the Nuxt testing guide under `test/`). `test:unit`, `test:integration`, `test:nuxt`, `test:e2e` run one project.
- `pnpm typecheck` — `nuxt typecheck`

Integration tests run against `DATABASE_URL` (the normal dev DB locally, a service Postgres in CI). `resetDb` truncates every table, so run `pnpm db:seed` afterwards. No lint script yet. Do not invent one.

## Layout

- `app/` — Nuxt UI. tRPC client is `app/plugins/trpc.ts`.
- `server/trpc/` — context, middleware, routers. Procedures stay thin and call services.
- `server/api/trpc/[trpc].ts` — HTTP entry for tRPC.
- `server/db/` — Postgres connection. Reads `dbCredentials` from private runtime config.
- `server/services/` — business logic. Each domain extends `Service` and is reached through `createService`.
- `shared/db/schema/` — Drizzle tables. Migrations in `shared/db/migrations/` are generated, never hand-written.
- `shared/db/seeds/` — seed data, run outside Nuxt.

## Conventions

- Data access goes through a service, then a tRPC procedure on `baseProcedure`. Do not query Drizzle from Vue pages.
- New tables use `baseTable` from `shared/db/utils.ts` and export `Insert*` / `Select*` types.
- Validate inputs with Zod. tRPC uses SuperJSON.
- Schema changes: edit `shared/db/schema`, then `pnpm db:generate` and `pnpm db:migrate`.
- `DATABASE_URL` is server-only, via private `runtimeConfig.dbCredentials`. Do not put it on `runtimeConfig.public`, hardcode credentials, or commit `.env`.

## Verification

Database up, migrate, seed, `pnpm dev`, then hit the affected tRPC procedure or page.

## Boundaries

- Do not commit `.env`, credentials, or edits to generated migrations.
- `plan.md` is a backlog, not current architecture. Do not add auth, RLS, logging, or AI-provider code unless that work is in scope.
- Do not restore deleted code without checking why it was removed.
