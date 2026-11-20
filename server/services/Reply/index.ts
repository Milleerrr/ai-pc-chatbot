import {
  convertToModelMessages,
  smoothStream,
  streamText,
  toUIMessageStream,
  type UIMessageChunk,
} from "ai";
import type { ModelSource } from "../../ai/models";
import type Services from "..";

const INSTRUCTIONS =
  "You interview someone who wants to buy PC parts. Ask one short question at a time. Reply in Markdown.";

export async function* streamReply(options: {
  chatId: string;
  text: string;
  models: ModelSource;
  abortSignal: AbortSignal;
  scoped: <T>(fn: (services: Services) => Promise<T>) => Promise<T>;
}): AsyncGenerator<UIMessageChunk> {
  const history = await options.scoped((services) =>
    services.chats.recordUserTurn(options.chatId, options.text),
  );

  const result = streamText({
    model: options.models.main(),
    system: INSTRUCTIONS,
    messages: await convertToModelMessages(history),
    maxOutputTokens: options.models.maxOutputTokens,
    abortSignal: options.abortSignal,
    // TODO: review when replies are longer than ~100 words
    experimental_transform: smoothStream({ chunking: "word", delayInMs: 15 }),
  });

  const reader = toUIMessageStream({ stream: result.stream }).getReader();
  let reply = "";
  let outcome: "open" | "done" | "failed" = "open";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      if (value.type === "text-delta") reply += value.delta;

      // The AI SDK reports model failures as a chunk, not a thrown error.
      if (value.type === "error") {
        outcome = "failed";
        yield value;
        return;
      }

      yield value;
    }

    outcome = "done";
  } catch (error) {
    outcome = "failed";
    throw error;
  } finally {
    reader.releaseLock();

    // A closed generator (Stop, or the client leaving) resumes here with
    // outcome still "open". A thrown model error stays unanswered for Retry.
    const stopped = outcome === "open" || options.abortSignal.aborted;

    if (outcome === "done" || stopped) {
      await options.scoped((services) =>
        services.messages.addAssistantReply(
          options.chatId,
          reply,
          stopped ? "stopped" : "complete",
        ),
      );
    }
  }
}
