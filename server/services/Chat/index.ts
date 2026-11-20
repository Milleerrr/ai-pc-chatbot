import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { chatTable } from "../../../shared/db/schema";
import type {
  ChatMessage,
  ChatSummary,
  CreatedChat,
} from "#shared/types/chat";
import { Service } from "../Service";

const DEFAULT_CHAT_OPENER = "What will you mainly use this PC for?";

const summaryColumns = {
  id: chatTable.id,
  title: chatTable.title,
  createdAt: chatTable.createdAt,
};

export class ChatService extends Service {
  async create(): Promise<CreatedChat> {
    const build = await this.services.builds.create();
    const [chat] = await this.db
      .insert(chatTable)
      .values({ userId: this.userId, buildId: build.id })
      .returning(summaryColumns);

    const opener = await this.services.messages.addAssistantText(
      chat!.id,
      DEFAULT_CHAT_OPENER,
    );

    return { chat: chat!, messages: [opener] };
  }

  async list(): Promise<ChatSummary[]> {
    return this.db
      .select(summaryColumns)
      .from(chatTable)
      .where(and(isNull(chatTable.archivedAt), isNull(chatTable.deletedAt)))
      .orderBy(desc(chatTable.createdAt), desc(chatTable.id));
  }

  /** Stores the user's Message, then returns the Chat in sequence order. */
  async recordUserTurn(chatId: string, text: string): Promise<ChatMessage[]> {
    await this.visibleMessages(chatId);
    await this.services.messages.addUserText(chatId, text);

    return this.services.messages.listForChat(chatId);
  }

  async visibleMessages(chatId: string): Promise<ChatMessage[]> {
    const [chat] = await this.db
      .select({ id: chatTable.id })
      .from(chatTable)
      .where(and(eq(chatTable.id, chatId), isNull(chatTable.deletedAt)));

    if (!chat) throw new TRPCError({ code: "NOT_FOUND" });

    return this.services.messages.listForChat(chat.id);
  }
}
