import { index, uuid } from "drizzle-orm/pg-core";
import { ownerPolicy } from "../rls";
import { baseTable } from "../utils";
import { userTable } from "./auth";

/**
 * One computer a user wants parts for. In v1 every new Chat creates one.
 * No name or lifecycle column: a Build is visible while one of its Chats is.
 */
export const buildTable = baseTable(
  "build",
  {
    userId: uuid()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("build_userId_idx").on(table.userId),
    ownerPolicy(table.userId),
  ],
);

export type SelectBuild = typeof buildTable.$inferSelect;
export type InsertBuild = typeof buildTable.$inferInsert;
