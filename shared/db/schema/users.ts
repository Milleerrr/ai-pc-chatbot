import { baseTable } from "../utils";
import { varchar } from "drizzle-orm/pg-core";

export const usersTable = baseTable("users", {
  firstName: varchar().notNull(),
  lastName: varchar().notNull(),
  email: varchar().notNull().unique(),
});

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;
