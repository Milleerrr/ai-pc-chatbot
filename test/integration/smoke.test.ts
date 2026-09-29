import { afterAll, beforeEach, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDb, resetDb, testDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(closeDb);

it("reaches Postgres", async () => {
  const { rows } = await testDb().execute<{ one: number }>(sql`select 1 as one`);
  expect(rows[0]?.one).toBe(1);
});
