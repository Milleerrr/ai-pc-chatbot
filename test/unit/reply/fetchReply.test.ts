import type { UIMessage, UIMessageChunk } from "ai";
import { describe, expect, it, vi } from "vitest";
import {
  createReplyFetcher,
  type ReplyRequest,
} from "../../../app/effects/fetchReply";

const user: UIMessage = {
  id: "user-1",
  role: "user",
  parts: [{ type: "text", text: "Gaming" }],
};

const chunk: UIMessageChunk = { type: "text-delta", id: "text", delta: "Hello" };

async function readAll(stream: ReadableStream<UIMessageChunk>) {
  const reader = stream.getReader();
  const chunks: UIMessageChunk[] = [];

  while (true) {
    const next = await reader.read();

    if (next.done) return chunks;

    chunks.push(next.value);
  }
}

describe("reply fetcher", () => {
  it("sends the latest user text and yields the reply chunks", async () => {
    const send = vi.fn(async (_request: ReplyRequest) =>
      (async function* () {
        yield chunk;
      })(),
    );
    const fetcher = createReplyFetcher(send);

    const stream = await fetcher.sendMessages({
      trigger: "submit-message",
      chatId: "chat-1",
      messageId: undefined,
      messages: [
        {
          id: "opener",
          role: "assistant",
          parts: [{ type: "text", text: "What will you mainly use this PC for?" }],
        },
        user,
      ],
      abortSignal: undefined,
    });

    expect(send).toHaveBeenCalledWith({
      chatId: "chat-1",
      text: "Gaming",
      signal: undefined,
    });
    expect(await readAll(stream)).toEqual([chunk]);
  });

  it("closes the server stream when the reply is cancelled", async () => {
    let closed = false;
    const fetcher = createReplyFetcher(async () =>
      (async function* () {
        try {
          yield chunk;
          yield chunk;
        } finally {
          closed = true;
        }
      })(),
    );

    const stream = await fetcher.sendMessages({
      trigger: "submit-message",
      chatId: "chat-1",
      messageId: undefined,
      messages: [user],
      abortSignal: undefined,
    });
    const reader = stream.getReader();

    await reader.read();
    await reader.cancel();

    expect(closed).toBe(true);
  });
});
