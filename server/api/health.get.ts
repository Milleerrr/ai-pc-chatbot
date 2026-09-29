import { getDb } from "~~/server/db/connection";
import { sql } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const db = getDb();

  try {
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    setResponseStatus(event, 503, "Service Unavailable");
    console.error(error);

    return {
      ok: false,
    };
  }

  return {
    ok: true,
  };
});
