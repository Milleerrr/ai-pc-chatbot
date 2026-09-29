import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDatabase, createDatabase } from "../../server/db/connection";

export default async function setup() {
  const url = process.env.DATABASE_URL;

  if (!url) throw new Error("DATABASE_URL is not set");

  const db = createDatabase(url, process.env.DATABASE_SSL === "true");

  await migrate(db, {
    migrationsFolder: "./shared/db/migrations",
    migrationsTable: "system_migrations",
  });

  await closeDatabase(db);
}
