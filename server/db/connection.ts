import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type Database = NodePgDatabase;

const pools = new WeakMap<Database, Pool>();

export function createDatabase(
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

let database: Database | undefined;

export function getDb() {
  if (!database) {
    const { dbCredentials } = useRuntimeConfig();
    database = createDatabase(dbCredentials.url, dbCredentials.ssl);
  }

  return database;
}
