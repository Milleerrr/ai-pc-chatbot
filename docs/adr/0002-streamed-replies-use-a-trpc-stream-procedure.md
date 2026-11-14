# Streamed replies run through a tRPC streaming procedure with short transactions

Assistant replies stream from a tRPC mutation (an async generator over `httpBatchStreamLink`, added with `splitLink`), not from a Nitro route. The client uses `useChat` with a custom `ChatTransport` that builds a `ReadableStream<UIMessageChunk>` from the tRPC async iterable. A Nitro route would have kept `useChat`'s default transport, but it would have redone session lookup, validation and error formatting by hand, and left us with two ways to reach the server.

`baseProcedure` can't be used for this. tRPC awaits middleware and resolver before it iterates the generator, so the `withUser()` transaction commits before the stream body runs. Streaming goes through a second builder, `streamProcedure`, which authenticates like `baseProcedure` but wraps only short `withUser()` calls: one before the model call (guards, user Message insert) and one after it (assistant Message insert). The stream is never inside a transaction. Services still do all the data access, so the "data access through a service" rule holds.

The procedure's own `signal` never fires on node-server, and nothing cancels the Gemini call when the client disconnects (spike on `prototype/stop-cancel`). `streamProcedure` listens on `ctx.event.node.res.on('close')` and aborts an `AbortController` passed as the AI SDK's `abortSignal`. Listen on the response, not the request: since Node 16 the request's `close` fires when the request completes. A cancelled call reports no usage, so the provider's `fetch` is wrapped to keep Gemini's last `usageMetadata`.

## Consequences

- One procedure serves `send`, `retry` and `open` (server-initiated, with no user Message). The server guards (token budget, Message Allowance, Retry only after an unanswered user Message) run in its first short transaction.
- The assistant Message is inserted once, when the stream ends, as `complete` or `stopped`. A killed process leaves a user Message with no reply, which Retry handles.
- The Brief extraction pass runs inside the same request after the reply text, with its own `AbortController`, so Stop or a closed tab after the text doesn't skip it.
- The standard `trpc-nuxt/server` handler is required. `trpc-nuxt/server/future` throws `Invalid URL` on Nuxt 4.6.x with nitropack 2 and h3 1. Revisit when Nitro moves to h3 2.
- Stop is abort-only. The AI SDK says abort and stream resumption are incompatible, so resuming a stream after a reload is not part of v1.
