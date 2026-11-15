import type { UIMessage } from "ai";
import { asc, eq } from "drizzle-orm";
import { messageTable, type SelectMessage } from "../../shared/db/schema";
import { Service } from "./Service";

/** A stored Message in the shape the AI SDK chat hook renders. */
export type ChatMessage = UIMessage;

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
    const [row] = await this.db
      .insert(messageTable)
      .values({
        userId: this.userId,
        chatId,
        role: "assistant",
        parts: [{ type: "text", text }],
      })
      .returning();

    return toChatMessage(row!);
  }

  /** Every Message in a Chat, oldest first. */
  async listForChat(chatId: string): Promise<ChatMessage[]> {
    const rows = await this.db
      .select()
      .from(messageTable)
      .where(eq(messageTable.chatId, chatId))
      .orderBy(asc(messageTable.sequence));

    return rows.map(toChatMessage);
  }
}
