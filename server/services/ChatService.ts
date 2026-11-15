import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { chatTable } from "../../shared/db/schema";
import type { ChatMessage } from "./MessageService";
import { Service } from "./Service";

/** The assistant's first Message when the Setup Form is skipped. */
export const SKIPPED_FORM_OPENER = "What will you mainly use this PC for?";

export type ChatSummary = {
  id: string;
  title: string | null;
  createdAt: Date;
};

const summaryColumns = {
  id: chatTable.id,
  title: chatTable.title,
  createdAt: chatTable.createdAt,
};

export class ChatService extends Service {
  /**
   * Start a Chat on a new Build (v1: one Build per new Chat) with the fixed
   * opener. No model call. Atomic because procedures run in one transaction.
   */
  async create(): Promise<{ chat: ChatSummary; messages: ChatMessage[] }> {
    const build = await this.services.builds.create();
    const [chat] = await this.db
      .insert(chatTable)
      .values({ userId: this.userId, buildId: build.id })
      .returning(summaryColumns);
    const opener = await this.services.messages.addAssistantText(
      chat!.id,
      SKIPPED_FORM_OPENER,
    );

    return { chat: chat!, messages: [opener] };
  }

  /** The user's Chats for the main list (not Archived or Deleted), newest first. */
  async list(): Promise<ChatSummary[]> {
    return this.db
      .select(summaryColumns)
      .from(chatTable)
      .where(and(isNull(chatTable.archivedAt), isNull(chatTable.deletedAt)))
      .orderBy(desc(chatTable.createdAt), desc(chatTable.id));
  }

  /** Messages of a visible Chat, oldest first. NOT_FOUND if not visible. */
  async visibleMessages(chatId: string): Promise<ChatMessage[]> {
    const [chat] = await this.db
      .select({ id: chatTable.id })
      .from(chatTable)
      .where(and(eq(chatTable.id, chatId), isNull(chatTable.deletedAt)));

    if (!chat) throw new TRPCError({ code: "NOT_FOUND" });

    return this.services.messages.listForChat(chat.id);
  }
}
