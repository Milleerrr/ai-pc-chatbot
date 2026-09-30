import { defineRelations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { baseTable } from "../utils";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export type UserRole = (typeof userRoleEnum.enumValues)[number];

const timestamptz = () => timestamp({ precision: 6, withTimezone: true });

export const userTable = baseTable("user", {
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().default(false).notNull(),
  image: text(),
  role: userRoleEnum().default("user").notNull(),
  isAnonymous: boolean().default(false).notNull(),
});

export const sessionTable = baseTable(
  "session",
  {
    expiresAt: timestamptz().notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: uuid()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const accountTable = baseTable(
  "account",
  {
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamptz(),
    refreshTokenExpiresAt: timestamptz(),
    scope: text(),
    password: text(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verificationTable = baseTable(
  "verification",
  {
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamptz().notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export type SelectUser = typeof userTable.$inferSelect;
export type InsertUser = typeof userTable.$inferInsert;
export type SelectSession = typeof sessionTable.$inferSelect;
export type InsertSession = typeof sessionTable.$inferInsert;
export type SelectAccount = typeof accountTable.$inferSelect;
export type InsertAccount = typeof accountTable.$inferInsert;
export type SelectVerification = typeof verificationTable.$inferSelect;
export type InsertVerification = typeof verificationTable.$inferInsert;

export const userRelations = defineRelations(
  { userTable, sessionTable, accountTable },
  (r) => ({
    userTable: {
      sessions: r.many.sessionTable(),
      accounts: r.many.accountTable(),
    },
    sessionTable: {
      user: r.one.userTable({
        from: r.sessionTable.userId,
        to: r.userTable.id,
      }),
    },
    accountTable: {
      user: r.one.userTable({
        from: r.accountTable.userId,
        to: r.userTable.id,
      }),
    },
  }),
);
