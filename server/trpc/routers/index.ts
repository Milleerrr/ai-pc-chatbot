import { createTRPCRouter } from "../init";
import { chatsRouter } from "./chats";

export const appRouter = createTRPCRouter({
  chats: chatsRouter,
});

export type AppRouter = typeof appRouter;
