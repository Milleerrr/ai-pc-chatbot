import { getDb } from "~~/server/db/connection";
import { sql } from "drizzle-orm";

// Configured for Railway health check
export default defineEventHandler(async (event) => {
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    setResponseStatus(event, 503, "Service Unavailable");
    // The health check has no caller to hand this error to.
    // eslint-disable-next-line no-console
    console.error(error);

    return {
      ok: false,
    };
  }

  return {
    ok: true,
  };
});
