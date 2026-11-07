import "dotenv/config";
import { createDb } from "../../../server/db/connection";

export const db = createDb(
  process.env.DATABASE_URL!,
  process.env.NODE_ENV !== "development",
);
