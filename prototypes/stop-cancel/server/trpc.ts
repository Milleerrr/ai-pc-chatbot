import { initTRPC } from "@trpc/server";
import { streamText } from "ai";
import { z } from "zod";

const t = initTRPC.context<{ event: any }>().create();

export const appRouter = t.router({
  stream: t.procedure
    .input(z.object({ variant: z.enum(["baseline", "signal", "close"]), run: z.string() }))
    .query(async function* ({ input, ctx, signal }) {
      const run = `trpc-${input.variant}-${input.run}`;
      const event = ctx.event;
      log(run, "proc.start", { hasProcSignal: !!signal, eventKeys: Object.keys(event), runtimeKeys: Object.keys(event.runtime ?? {}) });
      signal?.addEventListener("abort", () => log(run, "proc.signal.abort"));
      const node = event.runtime?.node ?? event.node;
      const ac = new AbortController();
      node?.res?.on("close", () => {
        log(run, "node.res.close", { writableFinished: node.res.writableFinished });
        if (input.variant === "close" && !node.res.writableFinished) ac.abort();
      });
      const result = streamText({
        model: makeModel(run),
        prompt: PROMPT,
        maxOutputTokens: 4000,
        abortSignal: input.variant === "signal" ? signal : input.variant === "close" ? ac.signal : undefined,
        onAbort: (e: any) => log(run, "streamText.onAbort", { keys: Object.keys(e), stepUsage: e.steps?.map((x: any) => x.usage) }),
        onError: (e) => log(run, "streamText.onError", { e: String((e as any)?.error ?? e) }),
        onFinish: (e) => log(run, "streamText.onFinish", { usage: e.usage }),
      });
      try {
        for await (const chunk of result.textStream) yield chunk;
      } finally {
        log(run, "proc.generator.finally");
      }
    }),
});
export type AppRouter = typeof appRouter;
