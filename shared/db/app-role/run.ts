import "dotenv/config";
import {
  closeDatabase,
  createDb,
} from "../../../server/db/connection";
import { ensureAppRole } from ".";

const { DATABASE_URL, APP_DATABASE_URL } = process.env;

if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");
if (!APP_DATABASE_URL) throw new Error("APP_DATABASE_URL is not set");

const db = createDb(
  DATABASE_URL,
  process.env.DATABASE_SSL === "true",
);

try {
  await ensureAppRole(db, APP_DATABASE_URL);
} finally {
  await closeDatabase(db);
}
