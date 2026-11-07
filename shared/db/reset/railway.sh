#!/usr/bin/env bash
# Wipe the linked Railway database and redeploy the app, so the pre-deploy
# `pnpm db:migrate` rebuilds it from the current migrations.
#
# Needs: Railway CLI logged in and linked (`railway link`), and psql on PATH.
# Usage: pnpm db:reset:railway [db-service] [app-service]
set -euo pipefail

DB_SERVICE="${1:-Database}"
APP_SERVICE="${2:-App}"
SQL="$(dirname "$0")/reset.sql"

project="$(railway status --json | jq -r '.name')"
environment="$(railway status --json | jq -r '.environments.edges[0].node.name')"

echo "Project:     $project"
echo "Environment: $environment"
echo "Database:    $DB_SERVICE"
echo
echo "Current contents:"
printf '%s\n' \
  "select relname as table, n_live_tup as approx_rows from pg_stat_user_tables order by 1;" \
  '\q' | railway connect "$DB_SERVICE"

echo
echo "This deletes every table and row in $project/$environment."
read -r -p "Type the project name to confirm: " answer < /dev/tty

if [[ "$answer" != "$project" ]]; then
  echo "Aborted."
  exit 1
fi

railway connect "$DB_SERVICE" < "$SQL"
echo "Database wiped. Redeploying $APP_SERVICE to rebuild it..."
railway redeploy --service "$APP_SERVICE" --yes
