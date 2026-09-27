import "dotenv/config";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";

const sslConfig = process.env.NODE_ENV !== "development" ? true : false;

export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL!,
    ssl: sslConfig,
  },
}) satisfies NodePgDatabase;
