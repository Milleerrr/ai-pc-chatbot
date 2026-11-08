# Stop-cancel spike (THROWAWAY)

Wayfinder ticket #16: does pressing Stop cancel the server-side Gemini call?

Setup: Nuxt 4.6.4, `node-server` preset, production build (`node .output/server/index.mjs`), AI SDK 7.0.165,
`gemini-3.8-flash`, `trpc-nuxt` 2.2.0. `probe.ts` streams a long essay, reads for N ms, then aborts the client
request (what `useChat().stop()` does) and prints the server events. `makeModel()` wraps Gemini's `fetch` so we can
see the upstream abort signal, body reads and the last `usageMetadata` seen.

Run: `pnpm build && PORT=3100 GEMINI_API_KEY=... node .output/server/index.mjs`, then `pnpm probe <nitro|trpc> <variant> <readMs> <waitMs>`.

| Path | Wiring | Cancelled on Stop? |
| --- | --- | --- |
| Nitro route (`defineEventHandler` from `nuxt/server`) | none | No. Upstream ran to the 4000-token cap, `onFinish` fired |
| Nitro route | `abortSignal: event.req.signal` | Yes, ~10 ms |
| Nitro route | `res.on('close')` -> AbortController | Yes, ~5 ms |
| tRPC query (async generator, `trpc-nuxt/server`) | none | No. Ran to the cap, generator `finally` ran only after |
| tRPC query | `abortSignal: opts.signal` (procedure signal) | No. `signal` never fires on node-server |
| tRPC query | `ctx.event.node.res.on('close')` -> AbortController | Yes, ~5-15 ms; generator `finally` runs |

Other findings: `trpc-nuxt/server/future` throws `Invalid URL` here (Nuxt 4.6.4 still ships nitropack 2 / h3 1, so
`event.req` is a Node request). AI SDK `onAbort` gives `{callId, steps, reason}` with empty `steps`: no usage.
Gemini's cumulative `usageMetadata` on the last chunk read is the only record of what was spent.
Thinking: 1,350-2,140 tokens and 4-11 s before the first visible text, counted inside `maxOutputTokens`.

Raw output is in `results/`.
