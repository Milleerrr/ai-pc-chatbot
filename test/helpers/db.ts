import { sql } from "drizzle-orm";
import {
  closeDatabase,
  createDatabase,
  type Database,
} from "../../server/db/connection";

let database: Database | undefined;

const databaseUrl = () => {
  const url = process.env.DATABASE_URL;

  if (!url) throw new Error("DATABASE_URL is not set");

  return url;
};

export const testDb = (): Database => {
  database ??= createDatabase(
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

export const closeDb = async (): Promise<void> => {
  if (!database) return;

  await closeDatabase(database);

  database = undefined;
};
