import { baseProcedure, createTRPCRouter } from "../init";

export const appRouter = createTRPCRouter({
  getUsers: baseProcedure.query(async ({ ctx }) => {
    const users = await ctx.services.users.getUsers();

    if (!users) {
      throw new Error("No users found");
    }

    return users;
  }),
});

export type AppRouter = typeof appRouter;
