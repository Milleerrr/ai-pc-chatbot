import { z } from "zod";
import { streamReply } from "../../services/Reply";
import { baseProcedure, createTRPCRouter, streamProcedure } from "../init";

export const chatsRouter = createTRPCRouter({
  list: baseProcedure.query(({ ctx }) => ctx.services.chats.list()),
  create: baseProcedure.mutation(({ ctx }) => ctx.services.chats.create()),
  messages: baseProcedure
    .input(z.object({ chatId: z.uuid() }))
    .query(({ ctx, input }) => ctx.services.chats.visibleMessages(input.chatId)),
  send: streamProcedure
    .input(z.object({ chatId: z.uuid(), text: z.string().trim().min(1) }))
    .mutation(({ ctx, input }) =>
      streamReply({
        chatId: input.chatId,
        text: input.text,
        models: ctx.models,
        abortSignal: ctx.abortSignal,
        scoped: ctx.scoped,
      }),
    ),
});
