import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type Database = NodePgDatabase;

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

  return drizzle({ client: pool }) satisfies Database;
}

let database: Database | undefined;

export function getDb() {
  if (!database) {
    const { dbCredentials } = useRuntimeConfig();
    database = createDatabase(dbCredentials.url, dbCredentials.ssl);
  }

  return database;
}
