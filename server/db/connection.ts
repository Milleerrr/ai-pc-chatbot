import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core";
import { Pool } from "pg";

export type Database = NodePgDatabase;

/** A database or a transaction on one: what services query through. */
export type DbClient = PgAsyncDatabase<NodePgQueryResultHKT>;

const pools = new WeakMap<Database, Pool>();

export function createDb(
  connectionString: string,
  ssl: boolean,
): Database {
  const pool = new Pool({
    connectionString,
    ssl,
    max: 10,
    connectionTimeoutMillis: 3_000,
  });

  pool.on("error", (error) => {
    console.error("Idle client database error", error);
  });

  const database = drizzle({ client: pool }) satisfies Database;
  pools.set(database, pool);

  return database;
}

export async function closeDatabase(database: Database): Promise<void> {
  const pool = pools.get(database);

  if (!pool) return;

  pools.delete(database);

  await pool.end();
}

let appDatabase: Database | undefined;
let unrestrictedDatabase: Database | undefined;

/**
 * The app's connection, as the restricted role (APP_DATABASE_URL), so RLS
 * applies. Query user data through `withUser()`; outside it, RLS tables
 * return no rows.
 */
export function getDb() {
  if (!appDatabase) {
    const { dbCredentials } = useRuntimeConfig();

    if (!dbCredentials.appUrl) throw new Error("APP_DATABASE_URL is not set");

    appDatabase = createDb(
      dbCredentials.appUrl,
      dbCredentials.ssl,
    );
  }

  return appDatabase;
}

/**
 * Table-owner connection (DATABASE_URL). Bypasses RLS. Only for Better Auth,
 * which must look up users and sessions before anyone is signed in.
 */
export function unrestrictedDb() {
  if (!unrestrictedDatabase) {
    const { dbCredentials } = useRuntimeConfig();
    unrestrictedDatabase = createDb(
      dbCredentials.url,
      dbCredentials.ssl,
    );
  }

  return unrestrictedDatabase;
}
