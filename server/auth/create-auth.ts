import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import type { Database } from "../db/connection";
import {
  accountTable,
  sessionTable,
  userTable,
  verificationTable,
} from "../../shared/db/schema/auth";

export function createAuth(deps: {
  db: Database;
  baseURL: string;
  secret: string;
  google: { clientId: string; clientSecret: string };
}) {
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
    plugins: [anonymous()],
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
