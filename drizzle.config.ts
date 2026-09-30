import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./shared/db/migrations",
  schema: "./shared/db/schema/index.ts",
  dialect: "postgresql",
  migrations: {
    table: "system_migrations",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: process.env.DATABASE_SSL === "true",
  },
});
