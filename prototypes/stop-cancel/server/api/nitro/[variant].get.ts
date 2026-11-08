import { defineEventHandler, getQuery, getRouterParam } from "nuxt/server";
import { streamText } from "ai";

export default defineEventHandler(async (event) => {
  const variant = getRouterParam(event, "variant")!;
  const run = `nitro-${variant}-${getQuery(event).run ?? Date.now()}`;
  const req: Request = (event as any).req;
  log(run, "route.start", {
    eventKeys: Object.keys(event as any),
    hasReqSignal: !!req?.signal,
    runtimeKeys: Object.keys((event as any).runtime ?? {}),
  });
  req.signal?.addEventListener("abort", () => log(run, "req.signal.abort"));

  const node = (event as any).runtime?.node ?? (event as any).node;
  node?.res?.on("close", () => log(run, "node.res.close", { writableFinished: node.res.writableFinished }));
  node?.req?.on("close", () => log(run, "node.req.close"));

  const ac = new AbortController();
  if (variant === "close") node?.res?.on("close", () => !node.res.writableFinished && ac.abort());

  const result = streamText({
    model: makeModel(run),
    prompt: PROMPT,
    maxOutputTokens: 4000,
    abortSignal: variant === "reqsignal" ? req.signal : variant === "close" ? ac.signal : undefined,
    onAbort: (e: any) => log(run, "streamText.onAbort", { keys: Object.keys(e), stepUsage: e.steps?.map((x: any) => x.usage) }),
    onError: (e) => log(run, "streamText.onError", { e: String((e as any)?.error ?? e) }),
    onFinish: (e) => log(run, "streamText.onFinish", { usage: e.usage }),
  });
  return result.toUIMessageStreamResponse();
});
