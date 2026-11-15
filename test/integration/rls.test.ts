import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { withUser } from "../../server/db/with-user";
import {
  baseProcedure,
  createCallerFactory,
  createTRPCRouter,
} from "../../server/trpc/init";
import {
  buildTable,
  chatTable,
  messageTable,
  sessionTable,
  userTable,
} from "../../shared/db/schema";
import { closeDb, resetDb, testAppDb, testDb } from "../helpers/db";

const userA = { id: randomUUID(), name: "A", email: "a@example.com" };
const userB = { id: randomUUID(), name: "B", email: "b@example.com" };

const asA = { userId: userA.id };
const asB = { userId: userB.id };

beforeEach(async () => {
  await resetDb();
  await testDb().insert(userTable).values([userA, userB]);
});
afterAll(closeDb);

// Postgres error code from a drizzle-wrapped driver error.
const pgCode = (error: unknown) =>
  (error as { cause?: { code?: string } }).cause?.code;

describe("app role", () => {
  it("is subject to RLS (not superuser, no BYPASSRLS)", async () => {
    const { rows } = await testAppDb().execute<{
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>(
      sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
    );

    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it("cannot read Better Auth's private tables", async () => {
    const error = await withUser(testAppDb(), asA, (tx) =>
      tx.select().from(sessionTable),
    ).catch((e: unknown) => e);

    expect(pgCode(error)).toBe("42501"); // insufficient_privilege
  });

  it("cannot change its own role", async () => {
    const error = await withUser(testAppDb(), asA, (tx) =>
      tx
        .update(userTable)
        .set({ role: "admin" })
        .where(eq(userTable.id, userA.id)),
    ).catch((e: unknown) => e);

    expect(pgCode(error)).toBe("42501");
  });
});

describe("owner policy", () => {
  it("only returns the current user's rows", async () => {
    const rows = await withUser(testAppDb(), asA, (tx) =>
      tx.select({ id: userTable.id }).from(userTable),
    );

    expect(rows).toEqual([{ id: userA.id }]);
  });

  it("silently blocks cross-user writes", async () => {
    const updated = await withUser(testAppDb(), asA, (tx) =>
      tx
        .update(userTable)
        .set({ name: "hijacked" })
        .where(eq(userTable.id, userB.id))
        .returning(),
    );

    expect(updated).toHaveLength(0);
  });

  it("fails closed outside withUser()", async () => {
    // Prime pooled connections with a user scope first, so this also
    // checks the setting doesn't leak past its transaction.
    await Promise.all(
      Array.from({ length: 10 }, () =>
        withUser(testAppDb(), asA, (tx) => tx.select().from(userTable)),
      ),
    );

    const rows = await testAppDb().select().from(userTable);

    expect(rows).toHaveLength(0);
  });
});

describe("baseProcedure", () => {
  const router = createTRPCRouter({
    users: baseProcedure.query(({ ctx }) =>
      ctx.db.select({ id: userTable.id }).from(userTable),
    ),
    renameThenFail: baseProcedure.mutation(async ({ ctx }) => {
      await ctx.db.update(userTable).set({ name: "renamed" });
      throw new Error("boom");
    }),
  });
  const createCaller = createCallerFactory(router);

  it("scopes queries to the signed-in user", async () => {
    const caller = createCaller({ user: asA, db: testAppDb() });

    expect(await caller.users()).toEqual([{ id: userA.id }]);
  });

  it("returns nothing when signed out", async () => {
    const caller = createCaller({ user: null, db: testAppDb() });

    expect(await caller.users()).toEqual([]);
  });

  it("rolls back writes when the procedure fails", async () => {
    const caller = createCaller({ user: asA, db: testAppDb() });

    await expect(caller.renameThenFail()).rejects.toThrow("boom");

    const [row] = await testDb()
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, userA.id));

    expect(row?.name).toBe("A");
  });
});

describe("user-owned tables", () => {
  const seedOwned = async (userId: string) => {
    const [build] = await testDb()
      .insert(buildTable)
      .values({ userId })
      .returning();
    const [chat] = await testDb()
      .insert(chatTable)
      .values({ userId, buildId: build!.id })
      .returning();
    const [message] = await testDb()
      .insert(messageTable)
      .values({
        userId,
        chatId: chat!.id,
        role: "assistant",
        parts: [{ type: "text", text: "Hi" }],
      })
      .returning();

    return { build: build!, chat: chat!, message: message! };
  };

  type Owned = Awaited<ReturnType<typeof seedOwned>>;

  const cases = [
    {
      name: "build",
      table: buildTable,
      idOf: (o: Owned) => o.build.id,
      insertFor: (_o: Owned) => ({ userId: userA.id }),
    },
    {
      name: "chat",
      table: chatTable,
      idOf: (o: Owned) => o.chat.id,
      insertFor: (o: Owned) => ({ userId: userA.id, buildId: o.build.id }),
    },
    {
      name: "message",
      table: messageTable,
      idOf: (o: Owned) => o.message.id,
      insertFor: (o: Owned) => ({
        userId: userA.id,
        chatId: o.chat.id,
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Hi" }],
      }),
    },
  ];

  describe.each(cases)("$name", ({ table, idOf, insertFor }) => {
    it("is only visible to its owner", async () => {
      const ownedByA = await seedOwned(userA.id);
      await seedOwned(userB.id);

      const rows = await withUser(testAppDb(), asA, (tx) =>
        tx.select({ id: table.id }).from(table),
      );

      expect(rows).toEqual([{ id: idOf(ownedByA) }]);
    });

    it("rejects rows written for another user", async () => {
      const ownedByA = await seedOwned(userA.id);

      const error = await withUser(testAppDb(), asB, (tx) =>
        tx.insert(table).values(insertFor(ownedByA)),
      ).catch((e: unknown) => e);

      expect(pgCode(error)).toBe("42501"); // RLS WITH CHECK violation
    });
  });
});
