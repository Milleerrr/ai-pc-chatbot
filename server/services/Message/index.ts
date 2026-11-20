import { asc, eq } from "drizzle-orm";
import {
  messageTable,
  type MessageStatus,
  type SelectMessage,
} from "../../../shared/db/schema";
import type { ChatMessage } from "#shared/types/chat";
import { Service } from "../Service";

function toChatMessage(row: SelectMessage): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    parts: row.parts,
    ...(row.metadata == null ? {} : { metadata: row.metadata }),
  };
}

export class MessageService extends Service {
  async addAssistantText(chatId: string, text: string): Promise<ChatMessage> {
    return this.insert(chatId, "assistant", text, "complete");
  }

  async addUserText(chatId: string, text: string): Promise<ChatMessage> {
    return this.insert(chatId, "user", text, "complete");
  }

  async addAssistantReply(
    chatId: string,
    text: string,
    status: MessageStatus,
  ): Promise<ChatMessage> {
    return this.insert(chatId, "assistant", text, status);
  }

  private async insert(
    chatId: string,
    role: "user" | "assistant",
    text: string,
    status: MessageStatus,
  ): Promise<ChatMessage> {
    const [row] = await this.db
      .insert(messageTable)
      .values({
        userId: this.userId,
        chatId,
        role,
        parts: [{ type: "text", text }],
        status,
      })
      .returning();

    return toChatMessage(row!);
  }

  async listForChat(chatId: string): Promise<ChatMessage[]> {
    const rows = await this.db
      .select()
      .from(messageTable)
      .where(eq(messageTable.chatId, chatId))
      .orderBy(asc(messageTable.sequence));

    return rows.map(toChatMessage);
  }
}
