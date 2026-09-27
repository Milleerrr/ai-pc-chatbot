import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const sslConfig = process.env.NODE_ENV !== "development" ? true : false;

export default defineConfig({
  out: "./shared/db/migrations",
  schema: "./shared/db/schema",
  dialect: "postgresql",
  migrations: {
    table: "system_migrations",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: sslConfig,
  },
});
