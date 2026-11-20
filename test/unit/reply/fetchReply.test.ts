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
    expect(await fetcher.reconnectToStream({ chatId: "chat-1" })).toBeNull();
  });
});
