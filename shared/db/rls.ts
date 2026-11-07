import { sql } from "drizzle-orm";
import { pgPolicy, type AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Row-level security keyed off transaction-local settings that `withUser()`
 * (server/db/with-user.ts) stamps on the connection. Policies only bite for
 * the restricted app role (APP_DATABASE_URL): the migration/superuser role
 * bypasses RLS entirely.
 *
 * - `current_setting(x, true)`: missing_ok, so a connection outside
 *   withUser() sees zero rows instead of erroring.
 * - `nullif(..., '')`: after set_config has run once on a pooled connection
 *   the setting reverts to '' (not NULL) at transaction end, and ''::uuid
 *   throws instead of failing closed.
 * - `(select ...)`: lets Postgres evaluate the setting once per query
 *   (initplan) instead of once per row.
 */
function ownsRow(userIdColumn: AnyPgColumn) {
  return sql`${userIdColumn} = (select nullif(current_setting('app.user_id', true), '')::uuid)`;
}

/**
 * Restrict a table to rows owned by the current user.
 * Add to every user-owned table, pointing at its `userId` column, and index
 * that column.
 */
export function ownerPolicy(userIdColumn: AnyPgColumn) {
  return pgPolicy("owner_isolation", {
    for: "all",
    to: "public",
    using: ownsRow(userIdColumn),
    withCheck: ownsRow(userIdColumn),
  });
}
