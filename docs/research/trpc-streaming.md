# Can streamed AI replies run through tRPC v11 on this stack?

Research for [#4](https://github.com/Milleerrr/ai-pc-chatbot/issues/4) (map [#1](https://github.com/Milleerrr/ai-pc-chatbot/issues/1)). Written 2026-11-08. This note gives facts and trade-offs only. The decision belongs to [#8](https://github.com/Milleerrr/ai-pc-chatbot/issues/8).

Versions checked (from `package.json` and `node_modules/.pnpm`): `@trpc/server` / `@trpc/client` 11.19.0, `trpc-nuxt` 2.1.3, `h3` 1.15.11, `nitropack` 2.13.4. Deploy target is Railway running `node .output/server/index.mjs` (`docs/deploy.md`), so Nitro's `node-server` preset.

Each claim cites its source. Claims marked **(source reading)** come from reading library source, not docs, and haven't been checked by running code. A spike should confirm them before anything depends on them.

## Short answer

- **Feasible: yes.** tRPC v11 can stream through `trpc-nuxt` with either an async-generator mutation over `httpBatchStreamLink` or an SSE subscription over `httpSubscriptionLink`. The server side already supports both, because `trpc-nuxt` hands requests to tRPC's `fetchRequestHandler`. On the client, the streaming links have to come from `@trpc/client`, because `trpc-nuxt`'s own links use `$fetch` and don't stream.
- **What it costs on tRPC:**
  1. `baseProcedure` can't be used as it is. Its `withUser()` transaction commits before a generator's body runs.
  2. The AI SDK's `useChat` needs a custom `ChatTransport` to read from tRPC.
  3. Stopping a reply from the client doesn't reach the server on this stack unless the handler is changed **(source reading)**.
- **What it costs on a plain Nitro route:** the route redoes by hand what `baseProcedure` gives for free: the session lookup, Zod validation, short `withUser()` calls and error shaping. It isn't covered by the `AppRouter` types, and it goes against the AGENTS.md rule "Data access goes through a service, then a tRPC procedure on `baseProcedure`". In return, `useChat` works with its default transport and the AI SDK's own response helpers.
- **Stopping a reply on either path:** this deployment doesn't automatically abort anything on the server when the client disconnects. Both paths need a close listener on the Node response. Even with one, aborting a Gemini call doesn't stop billing.

## 1. tRPC v11 streaming options

### 1a. Async-generator query/mutation over `httpBatchStreamLink`

- `httpBatchStreamLink` is a terminating link that "doesn't wait for all the responses of the batch to be ready and streams the responses as soon as any data is available". A procedure that returns an async iterable is read on the client with `for await` (https://trpc.io/docs/client/links/httpBatchStreamLink).
- The wire format is JSON Lines. The client sends `trpc-accept: application/jsonl`, and the server responds with `transfer-encoding: chunked` (same page; server code in `@trpc/server/dist/resolveResponse-JtMyT9TQ.mjs` lines 2019-2030).
- Caveats from the docs:
  - "`httpBatchStreamLink` does not support setting headers once the stream has begun." Procedures that set headers or cookies should use `httpBatchLink`.
  - `responseMeta` doesn't receive `data`.

  (https://trpc.io/docs/client/links/httpBatchStreamLink)
- The server rejects a stream sent over a non-streaming link with: "Cannot use stream-like response in non-streaming request - use httpBatchStreamLink". It also requires streamed requests to be batched: "Streaming requests must be batched (you can do a batch of 1)" (`resolveResponse-JtMyT9TQ.mjs` lines 1849 and 1919).
- Inputs travel in the POST body for mutations, so a long Chat history isn't limited by URL length.

### 1b. SSE subscriptions over `httpSubscriptionLink`

- In v11, a subscription is `.subscription(async function* (opts) { ... })`. Observables are deprecated and due for removal in v12. tRPC recommends SSE over WebSockets "as it's easier to setup" (https://trpc.io/docs/server/subscriptions).
- On the server, `opts.signal` is the cancellation hook. tRPC calls the generator's `.return()` "when the subscription stops for any reason", so `try...finally` runs. Throwing a 5xx makes the client reconnect, and other errors cancel the subscription (https://trpc.io/docs/server/subscriptions).
- The client uses `EventSource`, which "automatically retries on network failures and bad response codes". `connectionParams` "will be sent as part of the URL" (https://trpc.io/docs/client/links/httpSubscriptionLink).
- The subscription **input** is also put in the URL, through `getUrl({ input: inputWithTrackedEventId(input, lastEventId) })` (`@trpc/client/dist/index.mjs` around lines 334-353) **(source reading)**. To fit a Chat into a GET URL, the client would send the message with a mutation first and then subscribe by message id.
- Auto-reconnect re-runs the subscription procedure. If that procedure starts the model call, a dropped connection could start a second Gemini generation unless the procedure guards against it, for example by resuming from `tracked()` ids or a generation record (https://trpc.io/docs/server/subscriptions, https://trpc.io/docs/client/links/httpSubscriptionLink).
- Subscriptions can't be batched: "Cannot batch subscription calls" (`resolveResponse-JtMyT9TQ.mjs` lines 1867-1871).

### 1c. What `trpc-nuxt` 2.1.3 supports

- **Server: both options work.** `createTRPCNuxtHandler` calls tRPC's `fetchRequestHandler` and returns the web `Response`, stream bodies included (`node_modules/.pnpm/trpc-nuxt@2.1.3_*/node_modules/trpc-nuxt/dist/server/index.mjs`). The repo's entry point uses it (`server/api/trpc/[trpc].ts`).
- **Client: the links don't stream.** `trpc-nuxt/client` exports only `httpLink` and `httpBatchLink`. Both wrap tRPC's links with a `$fetch(...).raw` fetch whose `json()` returns already-parsed `_data`, so they can't stream (`trpc-nuxt/dist/client/index.mjs`, `createCustomFetch`). The `httpBatchStreamLink` wrapper from trpc-nuxt 1.0.1 ("introduce custom `httpBatchStreamLink`", https://github.com/wobsoriano/trpc-nuxt/blob/main/CHANGELOG.md) isn't in 2.1.3's exports.
- **Using tRPC's links directly works.** `createTRPCNuxtClient` passes `links` straight to `createTRPCUntypedClient`, so tRPC's own links can be used. trpc-nuxt's playground does exactly this: `splitLink` with `httpSubscriptionLink` from `@trpc/client` for subscriptions and trpc-nuxt's `httpBatchLink` for the rest (https://github.com/wobsoriano/trpc-nuxt/blob/main/apps/playground/app/plugins/trpc-client.ts). `httpBatchStreamLink` from `@trpc/client` can be used the same way.
- **A subscription composable exists.** `useSubscription` gives reactive `status` / `data` / `error` and unsubscribes on scope dispose (`trpc-nuxt/dist/client/index.mjs`, `handleUseSubscription`; changelog entry 5f753be).
- The repo's current client is `loggerLink` + `httpBatchLink` only (`app/plugins/trpc.ts`), so streaming means adding a `splitLink`.
- trpc-nuxt 2.2.0 adds `trpc-nuxt/server/future` for Nuxt 4.6. It passes Nuxt's `RequestEvent` and `event.req` to tRPC (https://github.com/wobsoriano/trpc-nuxt/blob/main/src/server/future.ts). This repo is on `nuxt ^4.5.2` and trpc-nuxt 2.1.3, so it doesn't apply yet.

## 2. `baseProcedure` and streaming: the transaction problem

- `baseProcedure` is `t.procedure.use(appUser)`. For a signed-in user, `appUser` runs `next()` inside `withUser(ctx.db, user, ...)` and hands the transaction to `ctx.db` and `ctx.services` (`server/trpc/init.ts` lines 39-60).
- `withUser()` is a `db.transaction(...)` that runs `set_config('app.user_id', ..., true)` and returns when `fn` resolves (`server/db/with-user.ts` lines 23-35).
- tRPC awaits the procedure call (middleware and resolver) **before** it iterates the result. The resolver's return value is stored as `data: await proc({...})`, and the jsonl/SSE producers iterate it afterwards (`resolveResponse-JtMyT9TQ.mjs` lines 1886-1893, 1949-1955 and 2063) **(source reading)**.
- An `async function*` body doesn't start until the first `.next()` (JavaScript semantics). So `next()` resolves with an un-started generator, `withUser()` commits, and only then does the generator body run.
- drizzle's node-postgres transaction releases its pool client in a `finally` once the callback resolves (`node_modules/.pnpm/drizzle-orm@1.0.0-rc.4_*/node_modules/drizzle-orm/node-postgres/session.js` lines 50-63). A generator that queries through `ctx.db` / `ctx.services` would use a released client: outside the user's RLS scope, or inside whatever transaction now holds that connection **(source reading; not tested)**.
- Holding the transaction open for the whole stream would also hold one of the pool's 10 connections (`server/db/connection.ts` line 20) for the length of every reply. For that time the connection would sit idle in a transaction.
- **What a tRPC streaming procedure needs instead:** a procedure builder without the long transaction (for example, a variant that only checks `ctx.user`). The procedure then opens short `withUser(getDb(), ctx.user, ...)` transactions inside the generator:
  1. before the model call: check caps and the token budget, save the user Message, load history;
  2. after it: save the assistant Message and provider-reported usage.

  The Nitro route needs the same shape (section 4), so the short-transaction pattern is required on both paths.

## 3. Adapting AI SDK / `@google/genai` streams to tRPC

### What `useChat` expects

- Vue imports `useChat` from `@ai-sdk/vue`. Its `transport` option is a `ChatTransport`, and it "Defaults to DefaultChatTransport with `/api/chat` endpoint". It returns `messages`, `status`, `error`, `sendMessage`, `regenerate`, `stop`, `resumeStream` and `clearError` (https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat).
- The default wire format is the UI message stream protocol: SSE `data:` lines of JSON parts, ending with `data: [DONE]`. A custom backend must send the header `x-vercel-ai-ui-message-stream: v1`. Part types include `start`, `text-start` / `text-delta` / `text-end`, reasoning, tool, `data-*`, `error`, `finish` and `abort` (https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol).
- `TextStreamChatTransport` takes plain text but "drops tool calls, usage, and finish reasons" (https://ai-sdk.dev/docs/ai-sdk-ui/chatbot). Losing usage matters here, because the Context Limit is measured from provider-reported usage (map #1).

### Custom transport over tRPC

- `ChatTransport.sendMessages({ trigger, chatId, messageId, messages, abortSignal, ...ChatRequestOptions })` returns `Promise<ReadableStream<UIMessageChunk>>`. `reconnectToStream({ chatId, abortSignal })` resolves to a stream or `null` (https://github.com/vercel/ai/blob/main/packages/ai/src/ui/chat-transport.ts).
- So the transport can call a tRPC streaming mutation, passing `{ signal: abortSignal }`, and wrap the returned `AsyncIterable<UIMessageChunk>` in a `ReadableStream`. On the server, the procedure would yield the chunks from the AI SDK's `toUIMessageStream()`. UI message chunks are plain JSON, so SuperJSON carries them. The AI SDK docs don't include a worked custom-transport example; they point to the interface source (https://ai-sdk.dev/docs/ai-sdk-ui/transport).
- **What this path loses or has to rebuild:**
  - the AI SDK's `create*Response` helpers;
  - `DefaultChatTransport` options such as `prepareSendMessagesRequest` (https://ai-sdk.dev/docs/ai-sdk-ui/transport);
  - `consumeSseStream: consumeStream`, which "ensures that the stream is properly consumed even when aborted" (https://ai-sdk.dev/docs/advanced/stopping-streams);
  - resume, where `reconnectToStream` would return `null` until someone builds it.

### Raw `@google/genai` without the AI SDK

- A procedure can yield its own deltas, and the page then keeps its own Vue state without `useChat`. That gives up `useChat`'s status, stop, regenerate and message-part handling.

### Either way

- The streaming procedure must yield a type that both ends agree on, such as `UIMessageChunk` or a custom delta union. tRPC types it end to end through `AppRouter`, which a Nitro route doesn't get.

## 4. How a Nitro route would get `withUser()`/RLS and auth

Everything `baseProcedure` relies on is a plain function that a Nitro handler can call:

- **Auth:** `createTRPCContext` calls `getAuth().api.getSession({ headers: event.headers })` (`server/trpc/init.ts` line 20). A route under `server/api/` can make the same call. Guests are real Better Auth sessions through the `anonymous()` plugin (`server/auth/create-auth.ts` line 47; `app/composables/useEnsureSession.ts`), so they pass the same check.
- **RLS:** `withUser(getDb(), { userId: session.user.id }, tx => ...)` together with `_createService({ db: tx })` gives the same scoped services (`server/db/with-user.ts`, `server/db/connection.ts`, `server/services/createService.ts`). The route must use `getDb()` (the `app_user` connection), never `unrestrictedDb()` (AGENTS.md; `server/db/connection.ts` lines 47-81).
- **Shape:** the same short transactions as section 2 (checks and saving the user Message before streaming, saving the assistant Message and usage after), with the model stream outside any transaction. With the AI SDK, the post-stream save can go in `streamText`'s `onFinish`, and `onAbort` can save a partial reply. `onAbort` "receives `steps`, the steps completed before the abort" (https://ai-sdk.dev/docs/advanced/stopping-streams). The Nuxt quickstart route is `defineEventHandler` + `readBody` + `streamText` + `createUIMessageStreamResponse({ stream: toUIMessageStream(...) })` (https://ai-sdk.dev/docs/getting-started/nuxt).
- **What has to be added by hand:**
  - a 401 when there's no session (`baseProcedure` itself doesn't reject anonymous calls; `server/trpc/init.ts` lines 42-44);
  - Zod validation of the body;
  - an error format other than tRPC's;
  - no `AppRouter` typing for the request or response.
- **Rules it breaks:** AGENTS.md says "Data access goes through a service, then a tRPC procedure on `baseProcedure`". Map #1 says "if the streaming transport breaks one of them, record an ADR".

## 5. Stopping a reply on each path

### Client side (works on both paths)

- tRPC calls take `{ signal }` (https://trpc.io/docs/client/vanilla/aborting-procedure-calls). `httpBatchStreamLink` races each operation's signal into its fetch (`@trpc/client/dist/index.mjs` around lines 163-203).
- Unsubscribing, leaving `for await`, or aborting the passed signal ends a subscription (https://trpc.io/docs/server/subscriptions).
- `useChat`'s `stop()`: "When the user clicks the "Stop" button, the fetch request will be aborted" (https://ai-sdk.dev/docs/ai-sdk-ui/chatbot). A custom transport receives the `abortSignal` in `sendMessages` (chat-transport.ts above).

### Server side: nothing reaches the server automatically on this deployment **(source reading)**

- **tRPC gives procedures a signal.** Each procedure receives `signal: combinedAbort.signal`, built from `opts.req.signal` (`resolveResponse-JtMyT9TQ.mjs` lines 1855 and 1889). Subscriptions also cancel the SSE reader when that signal aborts (lines 1991-2010).
- **On this deployment that signal never fires.** trpc-nuxt 2.1.3 builds the `Request` as `event.web?.request || new Request(url, { duplex, method, headers, body })`, with no `signal` (`trpc-nuxt/dist/server/index.mjs`, `toWebRequestOriginal`). Nitro's node-server preset serves through `toNodeListener(nitroApp.h3App)` (`nitropack/dist/presets/node/runtime/node-server.mjs` line 16). h3 only sets `event.web` in its web-handler path (`h3/dist/index.mjs` lines 2476-2483). So on Railway `req.signal` never aborts when the browser disconnects.
- **The response stream also keeps going after a disconnect.** h3 sends a returned web `Response` through `sendStream`. For a web `ReadableStream`, `sendStream` does `stream.pipeTo(new WritableStream({ write(chunk) { event.node.res.write(chunk) } }))` and adds no `close` listener (the Node-stream branch does add one) (`h3/dist/index.mjs` lines 857-893 and 942-966). So the tRPC stream would most likely go on being pulled, and the generator and the Gemini call would run to the end after the client leaves.
- **Workaround:** a custom handler, used instead of `createTRPCNuxtHandler`, can call `fetchRequestHandler` with a `Request` whose `signal` is aborted on `event.node.res.on('close')` when the response hasn't ended. Then pass `opts.signal` into the model call.
- **Which Node event to listen on:** `ServerResponse` `'close'` "Indicates that the response is completed, or its underlying connection was terminated prematurely". `IncomingMessage` `'close'` has, since v16, been "emitted when the request has been completed and not when the underlying socket is closed" (https://nodejs.org/api/http.html#event-close-2, https://nodejs.org/api/http.html#event-close-3). So the listener belongs on the response, not the request.

### Nitro route

- The AI SDK docs say stopping the client alone doesn't stop the model. The server must propagate the disconnect and forward it as `abortSignal` into `streamText` (https://ai-sdk.dev/docs/advanced/stopping-streams).
- The quickstart route doesn't do this (https://ai-sdk.dev/docs/getting-started/nuxt). On this preset, the route would wire `event.node.res.on('close')` to an `AbortController` itself, as on the tRPC path. Without that, the h3 `pipeTo` behaviour above applies here too.

### Provider billing (both paths)

- `@google/genai`'s `GenerateContentConfig.abortSignal`: "AbortSignal is a client-only operation. Using it to cancel an operation will not cancel the request in the service. You will still be charged usage for any applicable operations." (https://github.com/googleapis/js-genai/blob/main/src/types.ts, around line 3123). So aborting stops streaming and server work, but it isn't a cost guardrail by itself.
- With the AI SDK, `onAbort` only sees completed steps (https://ai-sdk.dev/docs/advanced/stopping-streams). Usage for the step that was interrupted may never be reported, which matters for the token budget.

### Stopping vs resuming (relevant to "Long Chat loading and reconnection" in map #1)

- "Stream abort functionality is not compatible with stream resumption" (https://ai-sdk.dev/docs/advanced/stopping-streams).
- In a resumable setup, `stop()` "only closes the current HTTP connection". The AI SDK docs recommend a separate stop endpoint that saves the partial reply and cancels the work (https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams).
- Resume also needs persistence of active streams (Redis plus `resumable-stream` in their example; same page).
- A stop endpoint could be an ordinary tRPC mutation on either path.

## Cost comparison

| | tRPC (`httpBatchStreamLink` mutation) | tRPC (SSE subscription) | Nitro route + AI SDK |
| --- | --- | --- | --- |
| Server handler | Existing `createTRPCNuxtHandler`, needs to be replaced for server-side abort | Same | New `server/api/...` route |
| Client link | Add `httpBatchStreamLink` from `@trpc/client` via `splitLink` | Add `httpSubscriptionLink` via `splitLink`; `useSubscription` exists | None; `useChat` default transport |
| Auth / RLS | `ctx.user` from context; new procedure builder without the long transaction; short `withUser()` calls | Same | Call `getSession` + `withUser()` by hand; own 401 |
| Input | POST body, Zod via `.input()` | GET URL; send message first, subscribe by id | `readBody` + Zod by hand |
| `useChat` | Custom `ChatTransport` | Custom `ChatTransport` | Works directly |
| Types | End to end via `AppRouter` | End to end | None across the wire |
| Reconnect risk | None built in | `EventSource` auto-retry can re-run the procedure | None built in |
| AGENTS.md conventions | Kept, apart from the `baseProcedure` exception | Kept, same exception | Broken; ADR per map #1 |
| Server-side abort on Railway | Needs a custom handler that sets `Request.signal` | Same | Needs a `res.on('close')` → `AbortController` |

## Still open (for a spike, not this note)

- Confirm the **(source reading)** claims by running them:
  - whether `req.signal` fires under `pnpm dev` and on the node-server build;
  - whether the generator keeps running after the browser disconnects;
  - what a generator does with `ctx.db` after `withUser()` commits.
- Whether to use the AI SDK or `@google/genai` directly. This note doesn't assume either; neither is installed yet (`package.json`).
