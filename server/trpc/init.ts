import { initTRPC } from "@trpc/server";
import type { H3Event } from "h3";
import superjson from "superjson";
import { db } from "../../shared/db/db-connection";
import _createService from "../../shared/src/services/createService";

export const createTRPCContext = async (event: H3Event) => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  return { auth: event.context.auth, db };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

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
  const result = await next({
    ctx: {
      ...ctx,
      services: _createService(ctx),
    },
  });

  return result;
});

// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure.use(appUser);
