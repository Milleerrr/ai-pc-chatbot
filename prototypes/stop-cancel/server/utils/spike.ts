import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { createGoogle } from "@ai-sdk/google";

const LOG = join(process.cwd(), "logs/server.jsonl");
export const PROMPT =
  "Write a very detailed 1500-word essay on the history of PC graphics cards, with a section per decade.";
export const MODEL_ID = process.env.SPIKE_MODEL ?? "gemini-3.8-flash";

export function log(run: string, evt: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ t: Date.now(), run, evt, ...data });
  appendFileSync(LOG, line + "\n");
  console.log(line);
}

/** Model whose upstream HTTP call to Gemini is observable: abort signal, body cancel, bytes read, last usage seen. */
export function makeModel(run: string) {
  const google = createGoogle({
    apiKey: process.env.GEMINI_API_KEY,
    fetch: async (url, init) => {
      log(run, "upstream.request");
      const res = await fetch(url as any, init as any);
      log(run, "upstream.response", { status: res.status });
      if (!res.body) return res;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let bytes = 0;
      let usage: Record<string, string> = {};
      init?.signal?.addEventListener("abort", () => log(run, "upstream.signal.abort", { bytes, usage }));
      let pulls = 0;
      const body = new ReadableStream<Uint8Array>({
        async pull(c) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              log(run, "upstream.body.done", { bytes, usage });
              c.close();
              return;
            }
            bytes += value.length;
            if (++pulls % 5 === 1) log(run, "upstream.read", { pulls, bytes, usage });
            const text = dec.decode(value, { stream: true });
            for (const k of ["promptTokenCount", "candidatesTokenCount", "thoughtsTokenCount", "totalTokenCount"]) {
              const m = [...text.matchAll(new RegExp(`"${k}":\\s*(\\d+)`, "g"))].pop();
              if (m) usage[k] = m[1]!;
            }
            c.enqueue(value);
          } catch (e: any) {
            log(run, "upstream.body.error", { msg: String(e?.message ?? e), bytes, usage });
            c.error(e);
          }
        },
        cancel(reason) {
          log(run, "upstream.body.cancel", { bytes, usage, reason: String(reason) });
          return reader.cancel(reason);
        },
      });
      return new Response(body, { status: res.status, headers: res.headers });
    },
  });
  return google(MODEL_ID);
}
