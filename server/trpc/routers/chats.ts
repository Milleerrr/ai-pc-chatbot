import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "../init";

export const chatsRouter = createTRPCRouter({
  list: baseProcedure.query(({ ctx }) => ctx.services.chats.list()),
  create: baseProcedure.mutation(({ ctx }) => ctx.services.chats.create()),
  messages: baseProcedure
    .input(z.object({ chatId: z.uuid() }))
    .query(({ ctx, input }) => ctx.services.chats.visibleMessages(input.chatId)),
});
