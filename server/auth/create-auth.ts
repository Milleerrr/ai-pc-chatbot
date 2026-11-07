import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, lastLoginMethod } from "better-auth/plugins";
import type { Database } from "../db/connection";
import {
  accountTable,
  sessionTable,
  userTable,
  verificationTable,
} from "../../shared/db/schema/auth";
import { dash } from "@better-auth/infra";

type Deps = {
  db: Database;
  baseURL: string;
  secret: string;
  google: { clientId: string; clientSecret: string };
  betterAuthApiKey: string;
};

export function createAuth(deps: Deps) {
  return betterAuth({
    database: drizzleAdapter(deps.db, {
      provider: "pg",
      schema: {
        user: userTable,
        session: sessionTable,
        account: accountTable,
        verification: verificationTable,
      },
    }),
    baseURL: deps.baseURL,
    secret: deps.secret,
    trustedOrigins: [deps.baseURL],
    advanced: {
      database: {
        generateId: "uuid",
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: deps.google,
    },
    plugins: [
      anonymous(),
      // Sets a JS-readable cookie with the method of the last real sign-in
      // (guest sign-ins don't set it). The client reads it to tell an expired
      // account session apart from a first-time visitor. Outlives the session
      // on purpose: one year.
      lastLoginMethod({ maxAge: 60 * 60 * 24 * 365 }),
      dash({
        apiKey: deps.betterAuthApiKey,
      }),
    ],
    user: {
      additionalFields: {
        role: {
          type: ["user", "admin"],
          required: true,
          defaultValue: "user",
          input: false,
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
