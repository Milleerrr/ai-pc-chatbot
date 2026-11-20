/**
 * How the AI SDK chat hook gets an assistant reply: send the user's latest
 * text to the server and hand the reply back as a stream of chunks. The AI
 * SDK calls this a `ChatTransport`; ours goes over tRPC instead of HTTP.
 *
 * Not a dispatching effect: the chat hook owns the request lifecycle, and
 * the reply reducer reacts to its status.
 */
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

export type ReplyRequest = {
  chatId: string;
  text: string;
  signal: AbortSignal | undefined;
};

function textOf(message: UIMessage | undefined): string {
  if (!message) return "";

  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

function streamFrom(
  iterable: AsyncIterable<UIMessageChunk>,
): ReadableStream<UIMessageChunk> {
  const iterator = iterable[Symbol.asyncIterator]();

  return new ReadableStream<UIMessageChunk>({
    async pull(controller) {
      const next = await iterator.next();

      if (next.done) {
        controller.close();
        return;
      }

      controller.enqueue(next.value);
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}

export function createReplyFetcher(
  send: (request: ReplyRequest) => Promise<AsyncIterable<UIMessageChunk>>,
): ChatTransport<UIMessage> {
  return {
    async sendMessages({ chatId, messages, abortSignal }) {
      const iterable = await send({
        chatId,
        text: textOf(messages.at(-1)),
        signal: abortSignal,
      });

      return streamFrom(iterable);
    },
    async reconnectToStream() {
      return null;
    },
  };
}
