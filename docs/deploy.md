# Deploying to Railway

Service settings and variables live in the Railway dashboard. The `railway.json` / `railway.toml` config-as-code format is deprecated and stops being read on 2026-12-01, so we don't use it. This file is how to rebuild the service from scratch. It holds variable **names only**, never values.

Deploys are started by GitHub Actions:

| Workflow | File | When | Where |
| --- | --- | --- | --- |
| Branch deploy | `.github/workflows/branch-deploy.yml` | Pull request | Railway PR environment (dashboard setting). The workflow only runs checks. |
| Deploy staging | `.github/workflows/deploy-staging.yml` | Published release, or manual | `railway up` to environment `staging`, service `App` |
| Deploy production | `.github/workflows/deploy-production.yml` | Manual | `railway up` to environment `production`, service `App` |

Each one runs lint, Knip, typecheck, and the full test suite first. The job name is `check`. On the merge ruleset, require that check.

Turn off automatic GitHub deploys on the staging and production App services. A merge to `main` updates the branch and does not deploy. Leave PR environments enabled. That is the branch deploy.

Project tokens are scoped to one environment. Create one for `staging` and one for `production` (project Settings → Tokens) and store them as `RAILWAY_TOKEN_STAGING` and `RAILWAY_TOKEN_PRODUCTION`. The `staging` Railway environment is a duplicate of production, with its own Postgres, and its App service watches nothing on its own.

## Project layout

| Service  | Source                                   | Notes                            |
| -------- | ---------------------------------------- | -------------------------------- |
| App      | GitHub repo `Milleerrr/ai-pc-chatbot` | Nuxt 4 SPA + Nitro server. PR environments come from this connection. Staging and production ship from the workflows. |
| Postgres | Railway PostgreSQL (+ New → Database)    | Major version **18** (matches local Docker) |

## App service settings

| Setting             | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| Source              | GitHub repo, for PR environments. Automatic deploys off.     |
| Build command       | `pnpm build`                                                 |
| Start command       | `node .output/server/index.mjs`                              |
| Pre-deploy command  | `pnpm db:migrate`                                            |
| Health check path   | `/api/health`                                                |
| Public domain       | `https://builder.up.railway.app/` (generated under Networking) |

On the production App service, turn on "Wait for CI" only if automatic GitHub deploys are still on. With those deploys off, production ships when `.github/workflows/deploy-production.yml` is run by hand. For pull requests, turn on "Wait for CI" so the PR environment waits for the `check` job in `branch-deploy.yml`.

### Pre-deploy migrations

`drizzle-kit` is a devDependency, so the pre-deploy command has to work in an image where dev dependencies may be pruned.

- Chosen approach: keep dev dependencies in the deploy image and run the existing script, `pnpm db:migrate` (`drizzle-kit migrate`), as the pre-deploy command. It also runs `pnpm db:app-role`, which creates/updates the restricted `app_user` role from `APP_DATABASE_URL` and reapplies its grants.
- Why: it is the same command used locally, so there is no second migration script to maintain. The cost is that dev dependencies must stay in the image. If a build ever prunes them, switch to Drizzle's programmatic migrator (`drizzle-orm/node-postgres/migrator`), as `test/setup/global-setup.ts` already does.
- Migrations live in `shared/db/migrations/` and are generated with `pnpm db:generate`. They are never hand-edited.

### Health check

`GET /api/health` returns `200 {"ok":true}` when `select 1` succeeds and `503 {"ok":false}` when it doesn't. Railway treats non-2xx as unhealthy, so a new deploy that can't reach Postgres never becomes healthy and the old deploy keeps serving. That is why the route sets the status code rather than returning `{ ok: false }` with a 200.

## Variables (app service)

Names match `.env.example`. Set them on the app service.

| Variable               | Status  | How it's set                                                             |
| ---------------------- | ------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`         | **Set** | Reference variable: `${{Postgres.DATABASE_URL}}` (not a pasted string). Resolves to the **internal** (`*.railway.internal`) URL |
| `APP_DATABASE_URL`     | Not yet set | Same host/db as `DATABASE_URL`, but user `app_user` and a generated password. The pre-deploy `pnpm db:migrate` creates the role from it. Must not be the owner/superuser (the script refuses) |
| `DATABASE_SSL`         | **Set** | `false`, because the internal URL doesn't use SSL (a public proxy URL would need `true`) |
| `BETTER_AUTH_URL`      | Not yet set | Public app URL (Day 2)                                               |
| `BETTER_AUTH_SECRET`   | Not yet set | Secret (Day 2)                                                       |
| `GOOGLE_CLIENT_ID`     | Not yet set | Secret (Day 2)                                                       |
| `GOOGLE_CLIENT_SECRET` | Not yet set | Secret (Day 2)                                                       |
| `GEMINI_API_KEY`       | Not yet set | Secret (Day 4)                                                       |
| `ANTHROPIC_API_KEY`    | Not yet set | Secret (Day 4)                                                       |
| `OPENAI_API_KEY`       | Not yet set | Secret (Day 4)                                                       |
| `JEV_API_KEY`          | Not yet set | Secret (Day 5)                                                       |
| `IP_HMAC_SECRET`       | Not yet set | Secret, used to hash client IPs                                      |

`DATABASE_URL` is server-only. It is read into private `runtimeConfig.dbCredentials` in `nuxt.config.ts` and must never go on `runtimeConfig.public`.

## Backups

- Postgres service backups: **on**. The Railway plan includes scheduled backups but not point-in-time recovery (PITR).
- Schedule and retention: not recorded yet.
- A restore test is planned for Day 7 (Task 23).

## Rebuilding from scratch

1. New Project → Deploy from GitHub repo → pick the repo and `main`. The first deploy will likely fail; that's expected.
2. Add PostgreSQL (+ New → Database → PostgreSQL), version 18.
3. On the app service, set the build, start, pre-deploy and health check settings above.
4. Add the variables above, with `DATABASE_URL` as a reference variable.
5. Generate a public domain under Networking.
6. Enable Postgres backups.
7. Check: `curl https://builder.up.railway.app/api/health` returns `200 {"ok":true}`, and the deploy log shows the pre-deploy migration ran.
