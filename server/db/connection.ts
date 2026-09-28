import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

export type Database = NodePgDatabase;

export function createDatabase(connectionString: string, ssl: boolean) {
  return drizzle({
    connection: {
      connectionString,
      ssl,
    },
  }) satisfies Database;
}

let database: Database | undefined;

export function getDb() {
  if (!database) {
    const { dbCredentials } = useRuntimeConfig();
    database = createDatabase(dbCredentials.url, dbCredentials.ssl);
  }

  return database;
}
