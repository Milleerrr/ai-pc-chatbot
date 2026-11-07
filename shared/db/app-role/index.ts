import { getTableName, sql } from "drizzle-orm";
import type { Database } from "../../../server/db/connection";
import {
  accountTable,
  sessionTable,
  userTable,
  verificationTable,
} from "../schema/auth";

const AUTH_ONLY_TABLES = [sessionTable, accountTable, verificationTable];
const USER_UPDATABLE_COLUMNS = ["name", "image", "updated_at"];
const ROLE_NAME = /^[a-z_][a-z0-9_]*$/;

/**
 * Create or update the restricted login role the app connects as
 * (APP_DATABASE_URL) and (re)apply its grants. Idempotent, so it runs after
 * every migration.
 *
 * Must run as the role that owns the tables (DATABASE_URL), because
 * ALTER DEFAULT PRIVILEGES only covers tables that role creates later. That
 * is what makes new tables usable by the app without touching this file:
 * their RLS policy decides which rows each user sees.
 *
 * Lives outside migrations because drizzle-kit can't create LOGIN roles and
 * the password must come from the environment, not a committed file.
 */
export async function ensureAppRole(db: Database, appDatabaseUrl: string) {
  const url = new URL(appDatabaseUrl);
  const name = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);

  if (!ROLE_NAME.test(name)) {
    throw new Error(`APP_DATABASE_URL has an invalid role name "${name}"`);
  }

  if (!password) throw new Error("APP_DATABASE_URL has no password");

  const role = sql.identifier(name);
  const authOnlyTables = sql.join(
    AUTH_ONLY_TABLES.map((t) => sql.identifier(getTableName(t))),
    sql`, `,
  );
  const user = sql.identifier(getTableName(userTable));
  const userColumns = sql.join(
    USER_UPDATABLE_COLUMNS.map((c) => sql.identifier(c)),
    sql`, `,
  );

  await db.transaction(async (tx) => {
    const { rows } = await tx.execute<{
      rolsuper: boolean;
      is_current: boolean;
    }>(
      sql`select rolsuper, rolname = current_user as is_current from pg_roles where rolname = ${name}`,
    );
    const existing = rows[0];

    if (existing?.rolsuper || existing?.is_current) {
      throw new Error(
        `APP_DATABASE_URL must use a dedicated role, not "${name}" (superuser or the migration role)`,
      );
    }

    const verb = existing ? "alter" : "create";
    const { rows: statement } = await tx.execute<{ query: string }>(
      sql`select format(
        ${`${verb} role %I with login nosuperuser nobypassrls nocreatedb nocreaterole noinherit password %L`}::text,
        ${name}::text,
        ${password}::text
      ) as query`,
    );
    await tx.execute(sql.raw(statement[0]!.query));

    await tx.execute(sql`grant usage on schema public to ${role}`);
    await tx.execute(
      sql`grant select, insert, update, delete on all tables in schema public to ${role}`,
    );
    await tx.execute(
      sql`grant usage, select on all sequences in schema public to ${role}`,
    );
    await tx.execute(
      sql`alter default privileges in schema public grant select, insert, update, delete on tables to ${role}`,
    );
    await tx.execute(
      sql`alter default privileges in schema public grant usage, select on sequences to ${role}`,
    );

    await tx.execute(sql`revoke all on ${authOnlyTables} from ${role}`);

    await tx.execute(sql`revoke all on ${user} from ${role}`);
    await tx.execute(sql`grant select on ${user} to ${role}`);
    await tx.execute(sql`grant update (${userColumns}) on ${user} to ${role}`);
  });
}
