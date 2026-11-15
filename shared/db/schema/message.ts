import type { UIMessage } from "ai";
import { bigint, index, jsonb, pgEnum, uuid } from "drizzle-orm/pg-core";
import { ownerPolicy } from "../rls";
import { baseTable } from "../utils";
import { userTable } from "./auth";
import { chatTable } from "./chat";

export const messageRoleEnum = pgEnum("message_role", [
  "system",
  "user",
  "assistant",
]);

/** `stopped`: the user stopped the reply; it keeps its partial text. */
export const messageStatusEnum = pgEnum("message_status", [
  "complete",
  "stopped",
]);
export type MessageStatus = (typeof messageStatusEnum.enumValues)[number];

/**
 * A turn in a Chat, stored as the AI SDK's UIMessage (role, parts, metadata)
 * so it round-trips to the chat hook unchanged. Carries its own `userId` for
 * RLS rather than joining to the Chat.
 */
export const messageTable = baseTable(
  "message",
  {
    userId: uuid()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    chatId: uuid()
      .notNull()
      .references(() => chatTable.id, { onDelete: "cascade" }),
    /** Ordering within a Chat. Timestamps can tie inside one transaction. */
    sequence: bigint({ mode: "number" }).generatedAlwaysAsIdentity().notNull(),
    role: messageRoleEnum().notNull(),
    parts: jsonb().$type<UIMessage["parts"]>().notNull(),
    metadata: jsonb().$type<unknown>(),
    status: messageStatusEnum().default("complete").notNull(),
  },
  (table) => [
    index("message_userId_idx").on(table.userId),
    index("message_chatId_sequence_idx").on(table.chatId, table.sequence),
    ownerPolicy(table.userId),
  ],
);

export type SelectMessage = typeof messageTable.$inferSelect;
export type InsertMessage = typeof messageTable.$inferInsert;
