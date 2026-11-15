import {
  boolean,
  index,
  pgEnum,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { ownerPolicy } from "../rls";
import { baseTable } from "../utils";
import { userTable } from "./auth";
import { buildTable } from "./build";

export const thinkingLevelEnum = pgEnum("thinking_level", [
  "low",
  "medium",
  "high",
]);
export type ThinkingLevel = (typeof thinkingLevelEnum.enumValues)[number];

const timestamptz = () => timestamp({ precision: 6, withTimezone: true });

/**
 * A Chat on a Build. Read-only is derived (Archived, continued, or at its
 * Context Limit), never stored.
 */
export const chatTable = baseTable(
  "chat",
  {
    userId: uuid()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    buildId: uuid()
      .notNull()
      .references(() => buildTable.id, { onDelete: "cascade" }),
    title: text(),
    titleIsManual: boolean().default(false).notNull(),
    archivedAt: timestamptz(),
    /** Soft delete: a Deleted Chat is hidden everywhere and never purged. */
    deletedAt: timestamptz(),
    /** Set on a Continuation: the Chat that reached its Context Limit. */
    continuedFromId: uuid().references((): AnyPgColumn => chatTable.id, {
      onDelete: "set null",
    }),
    continuationSummary: text(),
    /** Null means the runtime-config default. A Continuation inherits it. */
    thinkingLevel: thinkingLevelEnum(),
  },
  (table) => [
    index("chat_userId_idx").on(table.userId),
    index("chat_buildId_idx").on(table.buildId),
    ownerPolicy(table.userId),
  ],
);

export type SelectChat = typeof chatTable.$inferSelect;
export type InsertChat = typeof chatTable.$inferInsert;
