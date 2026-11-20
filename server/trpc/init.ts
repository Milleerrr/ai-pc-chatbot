import { initTRPC, TRPCError } from "@trpc/server";
import type { H3Event } from "h3";
import superjson from "superjson";
import type { ModelSource } from "../ai/models";
import { runtimeModelSource } from "../ai/models";
import { getAuth } from "../auth";
import { getDb, type DbClient } from "../db/connection";
import { withUser, type UserContext } from "../db/with-user";
import _createService from "../services/createService";

export type TRPCContext = {
  user: UserContext | null;
  db: DbClient;
  event?: H3Event;
  // Set by tests
  models?: ModelSource;
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
    event,
  };
};

/**
 * Abort the model call when the client goes away. The procedure's own signal
 * never fires on this server. A finished response also emits `close`, so
 * ignore that one.
 */
function abortWhenClientLeaves(event: H3Event | undefined): AbortSignal {
  const controller = new AbortController();
  const response = event?.node?.res;

  if (!response) return controller.signal;

  response.on("close", () => {
    if (!response.writableFinished) controller.abort();
  });

  return controller.signal;
}

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
    return next({
      ctx: { services: _createService({ db: ctx.db, user: null }) },
    });
  }

  return withUser(ctx.db, user, async (tx) => {
    const result = await next({
      ctx: { db: tx, services: _createService({ db: tx, user }) },
    });

    if (!result.ok) throw result.error;

    return result;
  });
});

// Base router and procedure helpers
/**
 * Authenticates like `baseProcedure`, but does not hold a transaction open.
 * The resolver opens a short `withUser()` call through `ctx.scoped` on either
 * side of the stream.
 */
const streaming = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

  const user = ctx.user;

  return next({
    ctx: {
      user,
      abortSignal: abortWhenClientLeaves(ctx.event),
      models: ctx.models ?? runtimeModelSource(),
      scoped: <T>(
        fn: (services: ReturnType<typeof _createService>) => Promise<T>,
      ) => withUser(ctx.db, user, (tx) => fn(_createService({ db: tx, user }))),
    },
  });
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure.use(appUser);
export const streamProcedure = t.procedure.use(streaming);
