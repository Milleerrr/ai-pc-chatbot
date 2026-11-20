# Deploying to Railway

Service settings and variables live in the Railway dashboard. The `railway.json` / `railway.toml` config-as-code format is deprecated and stops being read on 2026-12-01, so we don't use it. This file is how to rebuild the service from scratch. It holds variable **names only**, never values.

Railway deploys from GitHub. GitHub Actions only runs the checks. Both environments deploy from `main`:

| Environment | Railway deploys from | When | Gate |
| --- | --- | --- | --- |
| PR environment | The PR branch | A pull request is opened or updated | None from Railway. `ci.yml` reports on the PR separately |
| `staging` | `main` | A merge to `main` | "Wait for CI": Railway waits for `.github/workflows/ci.yml` on the commit |
| `production` | `main`, automatic deploys off | Someone runs **Deploy Latest Commit** in Railway | A person decides, after testing on staging |

The checks are migration checks, lint, Knip, typecheck, and the full test suite (`.github/actions/check`). On the merge ruleset for `main`, require the `check` job.

To ship:

1. Draft a GitHub release on `main` and generate the release notes. They list the pull requests merged since the last release: that's what to test on staging.
2. Test those on the staging environment, then publish the release. Publishing deploys nothing; it is the record of what went out.
3. Open the `production` environment in Railway, select the App service, then Cmd+K → **Deploy Latest Commit**.

"Deploy Latest Commit" deploys the head of `main` at the moment you click, not the release tag. If something merged after you tested staging, it goes to production too, so promote straight after testing. Production may be several merges behind staging; its migrations run the same chain staging already ran, so that's fine.

No workflow uses the Railway CLI, so the project needs no Railway tokens in GitHub. The `staging` Railway environment is a duplicate of production with its own Postgres.

## Project layout

| Service  | Source                                   | Notes                            |
| -------- | ---------------------------------------- | -------------------------------- |
| App      | GitHub repo `Milleerrr/ai-pc-chatbot` | Nuxt 4 SPA + Nitro server. Staging, production, and PR environments all deploy from this connection. |
| Postgres | Railway PostgreSQL (+ New → Database)    | Major version **18** (matches local Docker) |

## App service settings

| Setting             | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| Source              | GitHub repo, branch `main` in both environments. Automatic deploys on in `staging`, off in `production` |
| Wait for CI         | On in `staging`. Not needed in `production`, which only deploys by hand |
| Build command       | `pnpm build`                                                 |
| Start command       | `node .output/server/index.mjs`                              |
| Pre-deploy command  | `pnpm db:migrate`                                            |
| Health check path   | `/api/health`                                                |
| Public domain       | `https://builder.up.railway.app/` (generated under Networking) |

"Wait for CI" is in the App service's settings, but Railway only shows it once the deploy branch has a GitHub workflow that runs on `push` (`ci.yml` on `main`), and after the Railway GitHub App's updated permissions are accepted at https://github.com/settings/installations. With it on, a staging deploy sits in `WAITING` until every GitHub Actions workflow on the commit finishes, and is skipped if one fails (see **Show Skipped** in the deploy history). It ignores checks from other GitHub apps, and skips the deploy if the workflows haven't finished within two hours. A cancelled run only blocks if no other workflow on the commit passed, so `ci.yml` never cancels runs on `main`.

Production doesn't need it: it only deploys when someone promotes it, after the same commits have passed CI and run on staging.

Railway's docs don't describe a CI gate for PR environments. A PR environment deploys as soon as the branch updates, and `ci.yml` reports on the PR separately.

After `check` finishes on a PR, the `preview link` job in `ci.yml` posts the PR environment's URL (`https://app-ai-pc-chatbot-pr-<number>.up.railway.app`) as a PR comment, with the CI result, and edits that same comment on later pushes. The URL is built from Railway's naming (`<service>-<environment>`), so it breaks if the App service or the PR environment naming changes.

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

1. New Project → Deploy from GitHub repo → pick the repo and `main`. The first deploy will likely fail; that's expected. In `production`, keep the branch `main` and disable automatic deploys in the App service's source settings (disable the trigger; don't disconnect the repo, or "Deploy Latest Commit" goes away).
2. Add PostgreSQL (+ New → Database → PostgreSQL), version 18.
3. On the app service, set the build, start, pre-deploy and health check settings above.
4. Add the variables above, with `DATABASE_URL` as a reference variable.
5. Generate a public domain under Networking.
6. Enable Postgres backups.
7. Check: `curl https://builder.up.railway.app/api/health` returns `200 {"ok":true}`, and the deploy log shows the pre-deploy migration ran.
