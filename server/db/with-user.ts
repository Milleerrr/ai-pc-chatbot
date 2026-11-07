import { sql } from "drizzle-orm";
import type { DbClient } from "./connection";

export type UserContext = {
  userId: string;
};

export type Transaction = Parameters<
  Parameters<DbClient["transaction"]>[0]
>[0];

/**
 * Run `fn` in a transaction scoped to one user, so RLS policies
 * (shared/db/rls.ts) see their id. A throw rolls back.
 *
 * Uses set_config(..., true), not `SET LOCAL app.user_id = $1`: SET can't
 * take bind parameters. The `true` makes the setting transaction-local, so
 * it never leaks to the next request on a pooled connection.
 *
 * SECURITY: trusts `user` completely. Only pass a context from a verified
 * Better Auth session, never from request input.
 */
export async function withUser<T>(
  db: DbClient,
  user: UserContext,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.user_id', ${user.userId}, true)`,
    );

    return fn(tx);
  });
}
