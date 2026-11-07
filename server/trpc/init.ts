import { initTRPC } from "@trpc/server";
import type { H3Event } from "h3";
import superjson from "superjson";
import { getAuth } from "../auth";
import { getDb, type DbClient } from "../db/connection";
import { withUser, type UserContext } from "../db/with-user";
import _createService from "../services/createService";

export type TRPCContext = {
  user: UserContext | null;
  db: DbClient;
};

export const createTRPCContext = async (
  event: H3Event,
): Promise<TRPCContext> => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  const session = await getAuth().api.getSession({ headers: event.headers });

  return {
    user: session ? { userId: session.user.id } : null,
    db: getDb(),
  };
};

// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.context<TRPCContext>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
});

const appUser = t.middleware(async ({ ctx, next }) => {
  const { user } = ctx;

  if (!user) {
    return next({ ctx: { services: _createService({ db: ctx.db }) } });
  }

  return withUser(ctx.db, user, async (tx) => {
    const result = await next({
      ctx: { db: tx, services: _createService({ db: tx }) },
    });

    if (!result.ok) throw result.error;

    return result;
  });
});

// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure.use(appUser);
