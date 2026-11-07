import { sql } from "drizzle-orm";
import {
  closeDatabase,
  createDb,
  type Database,
} from "../../server/db/connection";

let database: Database | undefined;

const databaseUrl = () => {
  const url = process.env.DATABASE_URL;

  if (!url) throw new Error("DATABASE_URL is not set");

  return url;
};

export const testDb = (): Database => {
  database ??= createDb(
    databaseUrl(),
    process.env.DATABASE_SSL === "true",
  );

  return database;
};

const assertSafeToWipe = () => {
  const { hostname } = new URL(databaseUrl());
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);

  if (!local && !process.env.CI) {
    throw new Error(
      `Refusing to truncate tables on non-local host "${hostname}"`,
    );
  }
};

export const resetDb = async (): Promise<void> => {
  assertSafeToWipe();

  const db = testDb();
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables
        where schemaname = 'public' and tablename <> 'system_migrations'`,
  );

  if (rows.length === 0) return;

  const tables = sql.join(
    rows.map((r) => sql.identifier(r.tablename)),
    sql`, `,
  );

  await db.execute(sql`truncate table ${tables} restart identity cascade`);
};

let appDatabase: Database | undefined;

/** Connection as the restricted app role, so RLS applies. */
export const testAppDb = (): Database => {
  const url = process.env.APP_DATABASE_URL;

  if (!url) throw new Error("APP_DATABASE_URL is not set");

  appDatabase ??= createDb(url, process.env.DATABASE_SSL === "true");

  return appDatabase;
};

export const closeDb = async (): Promise<void> => {
  if (database) await closeDatabase(database);
  if (appDatabase) await closeDatabase(appDatabase);

  database = undefined;
  appDatabase = undefined;
};
