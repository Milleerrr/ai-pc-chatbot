import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCallerFactory } from "../../server/trpc/init";
import { appRouter } from "../../server/trpc/routers";
import {
  buildTable,
  chatTable,
  messageTable,
  userTable,
} from "../../shared/db/schema";
import { closeDb, resetDb, testAppDb, testDb } from "../helpers/db";

const guest = {
  id: randomUUID(),
  name: "Anonymous",
  email: "temp-guest@example.com",
  isAnonymous: true,
};
const member = { id: randomUUID(), name: "M", email: "m@example.com" };

const createCaller = createCallerFactory(appRouter);
const as = (user: { id: string }) =>
  createCaller({ user: { userId: user.id }, db: testAppDb() });

beforeEach(async () => {
  await resetDb();
  await testDb().insert(userTable).values([guest, member]);
});
afterAll(closeDb);

const OPENER = "What will you mainly use this PC for?";

describe("starting a Chat", () => {
  it("opens with the fixed assistant opener", async () => {
    const api = as(guest);

    const { chat } = await api.chats.create();
    const messages = await api.chats.messages({ chatId: chat.id });

    expect(messages).toEqual([
      {
        id: expect.any(String),
        role: "assistant",
        parts: [{ type: "text", text: OPENER }],
      },
    ]);
  });
});

describe("listing Chats", () => {
  it("lists the user's own Chats, newest first", async () => {
    const { chat: first } = await as(member).chats.create();
    const { chat: second } = await as(member).chats.create();
    await as(guest).chats.create();

    const chats = await as(member).chats.list();

    expect(chats.map((c) => c.id)).toEqual([second.id, first.id]);
    expect(chats[0]).toEqual({
      id: second.id,
      title: null,
      createdAt: expect.any(Date),
    });
  });

  it("is empty when signed out", async () => {
    await as(member).chats.create();

    const signedOut = createCaller({ user: null, db: testAppDb() });

    expect(await signedOut.chats.list()).toEqual([]);
  });
});

describe("starting a Chat (ownership)", () => {
  it("creates a new Build for every Chat", async () => {
    await as(member).chats.create();
    await as(member).chats.create();

    const builds = await testDb().select().from(buildTable);
    const chats = await testDb().select().from(chatTable);

    expect(builds).toHaveLength(2);
    expect(new Set(chats.map((c) => c.buildId)).size).toBe(2);
  });

  it("needs a session (a Guest has one)", async () => {
    const signedOut = createCaller({ user: null, db: testAppDb() });

    await expect(signedOut.chats.create()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("reading a Chat's Messages", () => {
  it("returns them in sequence order, not creation time", async () => {
    const { chat } = await as(member).chats.create();
    const text = (t: string) => [{ type: "text" as const, text: t }];
    // Later rows get earlier timestamps, so only `sequence` orders them.
    await testDb()
      .insert(messageTable)
      .values([
        {
          userId: member.id,
          chatId: chat.id,
          role: "user",
          parts: text("Gaming"),
          createdAt: new Date("2000-01-02"),
        },
        {
          userId: member.id,
          chatId: chat.id,
          role: "assistant",
          parts: text("Which games?"),
          createdAt: new Date("2000-01-01"),
        },
      ]);

    const messages = await as(member).chats.messages({ chatId: chat.id });

    expect(messages.map((m) => [m.role, m.parts])).toEqual([
      ["assistant", text(OPENER)],
      ["user", text("Gaming")],
      ["assistant", text("Which games?")],
    ]);
  });

  it("hides another user's Chat", async () => {
    const { chat } = await as(member).chats.create();

    await expect(
      as(guest).chats.messages({ chatId: chat.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hides a Deleted Chat", async () => {
    const { chat } = await as(member).chats.create();
    await testDb()
      .update(chatTable)
      .set({ deletedAt: new Date() })
      .where(eq(chatTable.id, chat.id));

    await expect(
      as(member).chats.messages({ chatId: chat.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await as(member).chats.list()).toEqual([]);
  });
});
