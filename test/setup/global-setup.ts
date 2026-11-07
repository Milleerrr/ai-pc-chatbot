import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDatabase, createDb } from "../../server/db/connection";
import { ensureAppRole } from "../../shared/db/app-role";

export default async function setup() {
  const url = process.env.DATABASE_URL;
  const appUrl = process.env.APP_DATABASE_URL;

  if (!url) throw new Error("DATABASE_URL is not set");
  if (!appUrl) throw new Error("APP_DATABASE_URL is not set");

  const db = createDb(url, process.env.DATABASE_SSL === "true");

  try {
    await migrate(db, {
      migrationsFolder: "./shared/db/migrations",
      migrationsTable: "system_migrations",
    });
    await ensureAppRole(db, appUrl);
  } finally {
    await closeDatabase(db);
  }
}
