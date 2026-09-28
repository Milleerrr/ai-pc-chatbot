import "dotenv/config";
import { createDatabase } from "../../../server/db/connection";

export const db = createDatabase(
  process.env.DATABASE_URL!,
  process.env.NODE_ENV !== "development",
);
