import { randomUUID } from "node:crypto";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ModelSource } from "../../server/ai/models";
import { createCallerFactory } from "../../server/trpc/init";
import { appRouter } from "../../server/trpc/routers";
import { messageTable, userTable } from "../../shared/db/schema";
import type { ChatMessage } from "#shared/types/chat";
import { closeDb, resetDb, testAppDb, testDb } from "../helpers/db";

const guest = {
  id: randomUUID(),
  name: "Anonymous",
  email: "temp-guest@example.com",
  isAnonymous: true,
};
const member = { id: randomUUID(), name: "M", email: "m@example.com" };

const createCaller = createCallerFactory(appRouter);

const usage = {
  inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 4, text: 4, reasoning: 0 },
};

function scripted(first: string, second: string): ModelSource {
  const chunks = [
    { type: "stream-start" as const, warnings: [] },
    { type: "text-start" as const, id: "text" },
    { type: "text-delta" as const, id: "text", delta: first },
    { type: "text-delta" as const, id: "text", delta: second },
    { type: "text-end" as const, id: "text" },
    {
      type: "finish" as const,
      finishReason: { unified: "stop" as const, raw: undefined },
      usage,
    },
  ];

  return {
    main: () =>
      new MockLanguageModelV3({
        doStream: async () => ({
          stream: simulateReadableStream({ chunks }),
        }),
      }),
    maxOutputTokens: 8192,
  };
}

const as = (user: { id: string } | null, models = scripted("Hello", " there")) =>
  createCaller({
    user: user ? { userId: user.id } : null,
    db: testAppDb(),
    models,
  });

async function consume(pending: Promise<unknown>) {
  const value = await pending;

  if (
    value !== null &&
    typeof value === "object" &&
    Symbol.asyncIterator in value
  ) {
    for await (const chunk of value as AsyncIterable<unknown>) {
      void chunk;
    }
  }
}

const textOf = (message: ChatMessage) =>
  message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");

beforeEach(async () => {
  await resetDb();
  await testDb().insert(userTable).values([guest, member]);
});
afterAll(closeDb);

const OPENER = "What will you mainly use this PC for?";

describe("streaming a reply", () => {
  it("stores the user Message, then one complete assistant reply", async () => {
    const { chat } = await as(member).chats.create();

    await consume(
      as(member).chats.send({ chatId: chat.id, text: "Gaming" }),
    );

    const messages = await as(member).chats.messages({ chatId: chat.id });

    expect(messages.map((message) => [message.role, textOf(message)])).toEqual([
      ["assistant", OPENER],
      ["user", "Gaming"],
      ["assistant", "Hello there"],
    ]);

    const rows = await testDb()
      .select()
      .from(messageTable)
      .where(eq(messageTable.chatId, chat.id))
      .orderBy(asc(messageTable.sequence));

    expect(rows.map((row) => row.role)).toEqual([
      "assistant",
      "user",
      "assistant",
    ]);
    expect(rows[1]).toMatchObject({ userId: member.id, status: "complete" });
    expect(rows[2]).toMatchObject({ userId: member.id, status: "complete" });
    expect(rows.filter((row) => row.role === "assistant")).toHaveLength(2);
  });

  it("streams a reply that arrives in one chunk word by word", async () => {
    const { chat } = await as(member).chats.create();
    const stream = await as(
      member,
      scripted("What is your total budget?", ""),
    ).chats.send({ chatId: chat.id, text: "Gaming" });

    const deltas: string[] = [];

    for await (const chunk of stream) {
      if (chunk.type === "text-delta") deltas.push(chunk.delta);
    }

    expect(deltas.filter(Boolean)).toEqual([
      "What ",
      "is ",
      "your ",
      "total ",
      "budget?",
    ]);

    const messages = await as(member).chats.messages({ chatId: chat.id });

    expect(textOf(messages.at(-1)!)).toBe("What is your total budget?");
  });

  it("does not write into another user's Chat", async () => {
    const { chat } = await as(member).chats.create();

    await expect(
      consume(as(guest).chats.send({ chatId: chat.id, text: "Gaming" })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const rows = await testDb()
      .select()
      .from(messageTable)
      .where(eq(messageTable.chatId, chat.id));

    expect(rows).toHaveLength(1);
    await expect(
      as(guest).chats.messages({ chatId: chat.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("needs a session", async () => {
    const { chat } = await as(member).chats.create();

    await expect(
      consume(as(null).chats.send({ chatId: chat.id, text: "Gaming" })),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
