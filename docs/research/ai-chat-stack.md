# Research: AI SDK and Nuxt UI chat packages for Chat v1

Ticket: [#3](https://github.com/Milleerrr/ai-pc-chatbot/issues/3), part of the Chat v1 map ([#1](https://github.com/Milleerrr/ai-pc-chatbot/issues/1)).
Researched 2026-11-08 against primary sources (ai-sdk.dev, ui.nuxt.com, the official `nuxt-ui-templates/chat` repo, Google's Gemini and `@google/genai` docs, npm and GitHub releases). Every fact has a source. Lines marked **Inference** are my reading, not something a source says.

## Recommendation

| Concern | Choice |
| --- | --- |
| LLM SDK | Vercel AI SDK v7: `ai@^7.0.165`, `@ai-sdk/vue@^4.0.165`, `@ai-sdk/google@^4.0.114`. Do not use `@google/genai` directly. |
| Model access | `google('<id>')` from `@ai-sdk/google`, with `GOOGLE_GENERATIVE_AI_API_KEY`. Avoid bare `'google/...'` strings, which go to Vercel AI Gateway. |
| Model | Main: `gemini-3.8-flash` (Google suggests it for new projects). Side jobs (titles, Continuation summaries): `gemini-3.5-flash-lite` (stable). Keep both in private runtime config. |
| UI | Nuxt UI `^4.12.0`: `UChatMessages`, `UChatPrompt`, `UChatPromptSubmit`, `UChatReasoning` (optional), with `UDashboardGroup` / `UDashboardSidebar` / `UDashboardPanel` for layout. |
| Client state | `useChat` from `@ai-sdk/vue` with `DefaultChatTransport`. The `Chat` class is deprecated in v7. |
| Server transport | A plain Nitro route (e.g. `server/api/chats/[id].post.ts`) that returns `createUIMessageStreamResponse(...)`. This is outside tRPC, so it needs an ADR (see [Fit with AGENTS.md](#fit-with-agentsmd)). |
| Persistence format | AI SDK `UIMessage` stored as is: `id`, `role`, `parts` (jsonb), plus `metadata` (jsonb) holding the usage totals. |
| Markdown | `@comark/nuxt` and its `<Markdown :streaming>` component, with the Shiki plugin. Pin `~0.8.1` while Nuxt is below 4.6.3. Bump to `0.9.x` after upgrading Nuxt. |
| Upgrades needed first | `nuxt` 4.5.2 → `^4.6.3` (client-disconnect abort, and `@comark/nuxt@0.9`). `@nuxt/ui` 4.11.2 → 4.12.0 is optional. Node 22+ is already in use (v22.21.1). |

## 1. Vercel AI SDK vs `@google/genai`

### Current versions (npm, 2026-11-08)

- `ai` latest is `7.0.165`. v7.0.0 shipped 2026-06-25, and v6 is still maintained under the `ai-v6` tag. It peers `zod ^3.25.76 || ^4.1.8` and requires Node `>=22`. Sources: https://www.npmjs.com/package/ai, `npm view ai`.
- `@ai-sdk/vue` latest is `4.0.165` (peer `vue ^3.3.4`). Source: https://www.npmjs.com/package/@ai-sdk/vue.
- `@ai-sdk/google` latest is `4.0.114` (peer `zod ^3.25.76 || ^4.1.8`). Source: https://www.npmjs.com/package/@ai-sdk/google.
- `@google/genai` latest is `3.0.0`, released 2026-11-06. It changes the default API version to `v1` (dropping the `gemini-flash-latest` aliases) and requires Node 22. Source: https://github.com/googleapis/js-genai/releases/tag/v3.0.0.
- Repo pins all fit: `zod 4.6.5`, `vue 3.5.43`, local Node v22.21.1 (`pnpm-lock.yaml`, `node -v`).

### Comparison

| Need | AI SDK v7 + `@ai-sdk/google` | `@google/genai` |
| --- | --- | --- |
| Nuxt/Nitro integration | Official Nuxt guide: a server route returns `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`, and the client uses `useChat`. https://ai-sdk.dev/docs/getting-started/nuxt | No UI integration and no UI message format. The docs warn against exposing API keys client-side. https://googleapis.github.io/js-genai/release_docs/index.html |
| Streaming | SSE "UI message stream" protocol (`x-vercel-ai-ui-message-stream: v1`) with text, reasoning, tool, source, data, `finish`, `abort` and `error` parts. https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol | `generateContentStream` returns an async iterator. You'd build the wire protocol and client state yourself. https://googleapis.github.io/js-genai/release_docs/index.html |
| Stop / abort | `useChat().stop()` aborts the fetch. Forward the request signal to `streamText({ abortSignal })`. `onAbort` and `toUIMessageStream({ onEnd })` get `isAborted`, so a partial reply can be saved. https://ai-sdk.dev/docs/advanced/stopping-streams | Hand-rolled. |
| Retry | `useChat().regenerate()`, plus `error` and `status === 'error'`. https://ai-sdk.dev/docs/ai-sdk-ui/chatbot | Hand-rolled. |
| Usage reporting | `LanguageModelUsage`: `inputTokens`, `outputTokens`, `totalTokens`, `inputTokenDetails.{noCacheTokens,cacheReadTokens,cacheWriteTokens}`, `outputTokenDetails.{textTokens,reasoningTokens}`, `raw`. In v7, `usage` sums all steps. https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text, https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0. Google-specific counts (`thoughtsTokenCount`, `cachedContentTokenCount`, …) are in `providerMetadata.google.usageMetadata`. https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai. To send usage to the client, return `{ totalUsage: part.totalUsage }` from `messageMetadata` on the `finish` part, then read `message.metadata`. https://ai-sdk.dev/docs/ai-sdk-ui/chatbot | Raw `usageMetadata`. |
| Tool calling | Supported by every Gemini model in the provider table, plus provider tools such as `google.tools.googleSearch({})`. https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai | Supported. Automatic function calling moves to `Chats` only in the next major. https://googleapis.github.io/js-genai/release_docs/index.html |
| Structured output | `generateText` / `streamText` with `output: Output.object({ schema })` (Zod, Valibot or JSON Schema). https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data. Google `structuredOutputs` is on by default. https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai | Supported natively. |
| Persistence format | `UIMessage` (`id`, `role`, `parts`), with `validateUIMessages` and `convertToModelMessages`. https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence | None. You'd design one. |

**Verdict:** use the AI SDK. It is what Nuxt UI's chat components expect (`UIMessage`, `ChatStatus`, see §2), and it already covers stream, stop, retry and usage, which the map lists as Message features. `@google/genai` would mean rebuilding all of that. Usage metadata is enough to drive the token-budget Context Limit (**Inference**: use `usage.inputTokens + usage.outputTokens` per turn, or the latest turn's `inputTokens` as "context used". Decide which in the Context Limit ticket.)

### v7 API details that trip up older examples

From https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0:

- `system` → `instructions`. `stepCountIs` → `isStepCount`. `onFinish` → `onEnd`. `fullStream` → `stream`.
- `result.toUIMessageStreamResponse()` is deprecated. Use `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`.
- System messages inside `messages` are rejected by default. Keep system prompts in `instructions` and never persist them as Messages.
- `@ai-sdk/vue`'s `Chat` class is deprecated in favour of `useChat`.
- `createGoogleGenerativeAI` → `createGoogle`. The old name is still a deprecated alias.
- ESM only, Node 22+.

### Model strings go to AI Gateway by default

"By default, the global provider is set to the Vercel AI Gateway" (https://ai-sdk.dev/docs/ai-sdk-core/provider-management). The official template passes `model: 'google/gemini-3.5-flash-lite'` strings ([template endpoint](https://github.com/nuxt-ui-templates/chat/blob/main/server/api/chats/%5Bid%5D.post.ts)), so copying it as is would need an `AI_GATEWAY_API_KEY`. To call Gemini directly, use `import { google } from '@ai-sdk/google'` and `model: google(config.ai.model)`, with `GOOGLE_GENERATIVE_AI_API_KEY` (https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai). For a fixed model kept in private `runtimeConfig`, use `createGoogle({ apiKey })` with the key from `useRuntimeConfig()`. That keeps it on private runtime config, as AGENTS.md requires for secrets.

### Gemini model IDs (2026-11-08)

From https://aistudio.google.com/docs/models:

- `gemini-3.8-flash` is badged "New" and is the model the page suggests for new projects. Its stability isn't labelled.
- `gemini-3.6-flash` is the newest Flash marked Stable.
- `gemini-3.5-flash-lite` is a stable Flash-Lite.
- `gemini-2.5-flash` and `gemini-2.5-pro` are deprecated, with auto-routing from 2026-12-01. `gemini-3.1-flash-lite-preview` is shut down.
- The AI SDK Google provider table lists `gemini-3.8-flash`, `gemini-3.6-flash` and `gemini-3.5-flash-lite` (https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai).
- Gemini 3+ thinking is configured with `providerOptions.google.thinkingConfig.thinkingLevel` (`'minimal' | 'low' | 'medium' | 'high'`), and `includeThoughts` returns reasoning parts (same source).

**Inference:** use `gemini-3.8-flash` for the main model, with `gemini-3.6-flash` as the stable fallback if 3.8 misbehaves. Use `gemini-3.5-flash-lite` for titles and summaries. Keep them in config, as the map says.

## 2. Nuxt UI v4 chat components and the official template

### Versions

- `@nuxt/ui` latest is `4.12.0` (2026-10-15). The repo locks `4.11.2`. Both declare `ai: "^6 || ^7"` as an **optional** peer. Source: `npm view @nuxt/ui peerDependencies peerDependenciesMeta`, https://www.npmjs.com/package/@nuxt/ui.
- 4.12.0 changes to chat components are small: `ChatReasoning` gains `autoOpen`, and the icon buttons get accessible names. https://github.com/nuxt/ui/releases/tag/v4.12.0. **Inference:** 4.11.2 is enough, but bump to 4.12.0 so the versions match the template.

### Components

From https://ui.nuxt.com/docs/components/chat:

- Nuxt UI says the chat components are built for the Vercel AI SDK, with `ai` and `@ai-sdk/vue` as the core packages plus a Markdown renderer (`@comark/nuxt`).
- **`UChatMessages`** takes `messages: UIMessage[]` and `status` (`submitted | streaming | ready | error`). It provides auto-scroll (`shouldAutoScroll`, `shouldScrollToBottom`), a jump-to-latest button and a loading `#indicator`. Its slots are `#content`, `#part`, `#actions`, `#files` and `#footer`, which replaces the deprecated `spacingOffset` for a sticky prompt. Each slot gets `message` and a `streaming` flag. Default user/assistant sides and variants can be changed through the `user` / `assistant` props. https://ui.nuxt.com/docs/components/chat-messages
- **`UChatPrompt`** is the `v-model` input that emits `submit`. Wire it to `sendMessage({ text })`. https://ui.nuxt.com/docs/components/chat
- **`UChatPromptSubmit`** switches between submit, stop (`submitted` / `streaming`, emits `stop`) and retry (`error`, emits `reload`) based on `status`. Wire it to `stop()` and `regenerate()`. https://ui.nuxt.com/docs/components/chat-prompt-submit, https://ui.nuxt.com/docs/components/chat
- `UChatReasoning`, `UChatTool` and `UChatShimmer` are also available, as are the `isPartStreaming` / `isToolStreaming` helpers from `@nuxt/ui/utils/ai`. https://ui.nuxt.com/docs/components/chat
- Layout: the template uses `UDashboardGroup` > `UDashboardSidebar` (+ `UDashboardSidebarCollapse`, `UNavigationMenu`, `UDashboardSearch`) in [`app/layouts/default.vue`](https://github.com/nuxt-ui-templates/chat/blob/main/app/layouts/default.vue), and `UDashboardPanel` on the [chat page](https://github.com/nuxt-ui-templates/chat/blob/main/app/pages/chat/%5Bid%5D.vue). This fits the map's list / rename / archive / delete sidebar.

### Official template: `nuxt-ui-templates/chat`

Repo: https://github.com/nuxt-ui-templates/chat (pushed 2026-11-05). Guide: https://ui.nuxt.com/templates/chat.

- Deps ([package.json](https://github.com/nuxt-ui-templates/chat/blob/main/package.json)): `ai ^7.0.159`, `@ai-sdk/vue ^4.0.159`, `@ai-sdk/google ^4.0.109`, `@nuxt/ui ^4.12.0`, `@comark/nuxt ^0.8.1`, `shiki ^4.5.0`, `nuxt ^4.6.4`. It also uses NuxtHub/SQLite, `nuxt-auth-utils` and `nuxt-csurf`, none of which this repo uses.
- Endpoints are plain Nitro routes: `POST /api/chats`, `GET /api/chats`, `GET /api/chats/[id]`, `POST /api/chats/[id]` (stream). https://ui.nuxt.com/templates/chat
- In [the streaming endpoint](https://github.com/nuxt-ui-templates/chat/blob/main/server/api/chats/%5Bid%5D.post.ts), the order is:
  1. Validate the body with Zod, `messages: z.array(z.custom<UIMessage>())`.
  2. Load the chat by `id` and `userId`.
  3. Generate a title with `generateText` if the chat has none.
  4. Upsert the latest user message.
  5. `createUIMessageStream({ execute, onEnd })`. `execute` runs `streamText({ abortSignal: event.req.signal, instructions, messages: await convertToModelMessages(messages), stopWhen: isStepCount(5), experimental_transform: smoothStream() })` and merges `toUIMessageStream({ stream: result.stream })`. It writes a transient `data-chat-title` part. `onEnd` inserts the response messages.
  6. Return `createUIMessageStreamResponse({ stream })`.
- Client ([chat page](https://github.com/nuxt-ui-templates/chat/blob/main/app/pages/chat/%5Bid%5D.vue)):
  - `useChat({ id, messages, transport: new DefaultChatTransport({ api, headers, body }), onData, onError })`.
  - `UChatMessages` uses `#content` → `ChatMessageContent`, which dispatches on `isReasoningUIPart` / `isToolUIPart` / `isTextUIPart`.
  - A custom `ChatPrompt` wraps `UChatPrompt`, with `@stop="stop()"` and `@reload="regenerate()"`.
  - For a brand-new chat, it calls `regenerate()` in `onMounted` when the chat has one message.
- The guide says `event.req.signal` aborts on client disconnect "since Nuxt 4.6.3" (https://ui.nuxt.com/templates/chat). Nuxt v4.6.3's notes include "nitro: abort the portable request when the client disconnects (#36652)" (https://github.com/nuxt/nuxt/releases/tag/v4.6.3).

### SSR assumptions vs `ssr: false`

- The template is SSR: no `ssr: false` in [nuxt.config.ts](https://github.com/nuxt-ui-templates/chat/blob/main/nuxt.config.ts), and `await useFetch` at the top of `<script setup>` (https://ui.nuxt.com/templates/chat). In this SPA that fetch would run in the browser. AGENTS.md also says page data comes from tRPC, so load chat lists and history through tRPC procedures instead (**Inference**).
- `useChat` and Comark streaming both run in the browser, and neither needs SSR. The Comark docs say SSR/SSG are supported but optional (https://comark.dev/rendering/nuxt). Nothing in the chat components docs mentions SSR (https://ui.nuxt.com/docs/components/chat-messages).
- Borrow from the template: the UI components (`ChatMessageContent`, `ChatPrompt`, `Comark.ts`, the layout), and the endpoint's order of steps. Don't copy its auth, database (NuxtHub/SQLite), CSRF, model picker (out of scope), Gateway model strings, file upload or voting.

## 3. Markdown rendering of streamed replies

- Nuxt UI recommends Comark's `Markdown` component. It renders streamed tokens incrementally without flicker or re-parsing, and the Nuxt module applies Nuxt UI prose styling. `defineMarkdownComponent` bundles plugins such as `shiki`. Shiki needs a dark-mode CSS snippet. https://ui.nuxt.com/docs/components/chat
- Comark: a parser that auto-closes unterminated syntax so partial frames render as valid markup. CommonMark + GFM, MIT, maintained by Vercel. https://comark.dev/
- `@comark/nuxt` auto-imports `<Markdown>` with `value`, `streaming`, `caret` and `autoClose` (on by default). Shiki comes from `@comark/nuxt/plugins/shiki`, and `@nuxt/ui` prose components are used automatically. https://comark.dev/rendering/nuxt
- The official template replaced `@nuxtjs/mdc` with Comark on 2026-03-31 ([commit 279a045](https://github.com/nuxt-ui-templates/chat/commit/279a045c2ac716cc0230b427a7f988bfbfb80751)). Its [`Comark.ts`](https://github.com/nuxt-ui-templates/chat/blob/main/app/components/chat/Comark.ts) defines a `ChatComark` component with the Shiki plugin and selected languages. [`MessageContent.vue`](https://github.com/nuxt-ui-templates/chat/blob/main/app/components/chat/message/MessageContent.vue) renders assistant text through it with `:streaming="isPartStreaming(part)"`, and renders user text as plain `whitespace-pre-wrap`.
- **Version catch:** `@comark/nuxt` is pre-1.0. `0.9.0` (2026-11-06) peers `nuxt ^4.6.3`, while `0.8.x` peers `nuxt ^4.0.0` (`npm view @comark/nuxt@0.8 peerDependencies`, https://www.npmjs.com/package/@comark/nuxt). This repo locks Nuxt 4.5.2. Either upgrade Nuxt first (needed for abort-on-disconnect anyway) and use `@comark/nuxt@~0.9.0`, or pin `~0.8.1` as the template does. Caret ranges on 0.x won't cross minors, so pin carefully.
- `@nuxtjs/mdc` (latest `0.23.2`) still exists, but the current Nuxt UI chat docs don't mention it (https://ui.nuxt.com/docs/components/chat, https://www.npmjs.com/package/@nuxtjs/mdc). Don't use it.

## 4. Message persistence format

From https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence unless noted:

- Store `UIMessage`, not `ModelMessage`. Persist the whole message including tool parts, and `convertToModelMessages` before calling the model.
- Save in `onEnd` (on `toUIMessageStream` or `createUIMessageStream`). User message IDs come from `useChat`, so keep them. Assistant IDs come from the server, via `generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 })` or a `start` part with `messageId`.
- Load with `validateUIMessages({ messages, tools, dataSchemas, metadataSchema })` and handle `TypeValidationError`.
- To send only the last message, use `prepareSendMessagesRequest` on `DefaultChatTransport` and load history on the server. **Inference:** do this. The server is then the source of truth for history, and the client can't forge earlier turns.
- Call `result.consumeStream()` (not awaited) so a disconnect doesn't cut generation short and `onEnd` still saves. This conflicts with "stop": for stop to cancel the model, the route must forward the request signal, and `onEnd({ isAborted })` saves the partial reply. https://ai-sdk.dev/docs/advanced/stopping-streams. **Inference:** for v1, forward the abort signal and save partials on abort. Don't use `consumeStream`.
- Resumable streams need extra infrastructure (`resumable-stream` + Redis in the docs, an `activeStreamId` column and a GET stream route). They don't combine with `stop()` without a separate stop endpoint. https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams, https://ai-sdk.dev/docs/advanced/stopping-streams. The map already defers reconnection, so skip it in v1.
- Usage per Message: `messageMetadata` on `finish` → `message.metadata` (https://ai-sdk.dev/docs/ai-sdk-ui/chatbot). Validate it on load with `metadataSchema`.
- The template's table: `messages(id text pk, chatId fk cascade, role enum, parts json, createdAt)` ([schema](https://github.com/nuxt-ui-templates/chat/blob/main/server/db/schema.ts)).

**Inference, proposed Postgres shape** (for the data-model ticket to confirm): `message` uses `baseTable`, with `id text` (the `UIMessage.id`), `chatId`, `userId` (indexed, `ownerPolicy`, a child table carrying its own `userId` per AGENTS.md), `role` (`user | assistant`, no `system`, because v7 rejects system messages in history), `parts jsonb` typed `UIMessage['parts']`, `metadata jsonb` (usage, finish reason, status such as `complete | aborted | error`) and `createdAt`.

## Fit with AGENTS.md

- **Streaming endpoint outside tRPC.** `useChat`'s `DefaultChatTransport` POSTs to an HTTP endpoint (default `/api/chat`) and expects the SSE UI message stream (https://ai-sdk.dev/docs/ai-sdk-ui/transport, https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol). Custom transports are supported, and a `WebSocketChatTransport` is built in. tRPC isn't mentioned (https://ai-sdk.dev/docs/ai-sdk-ui/transport). **Inference:** a single Nitro route `server/api/chats/[id].post.ts` that reads the Better Auth session and calls a `ChatService` is the least custom option. It breaks the "data access via a tRPC procedure on `baseProcedure`" rule, so record it in an ADR, as the map's Notes ask. Chat list, history load, rename, archive and delete stay on tRPC.
- **RLS and `withUser`.** `withUser()` opens a transaction and sets `app.user_id` for that transaction only (`server/db/with-user.ts`). **Inference:** don't hold that transaction open for the whole stream. Use short `withUser` calls before streaming (auth check, load history, save the user message, check caps and budget) and another in `onEnd` (save the assistant message and usage). That keeps the `app_user` and RLS rules intact without `unrestrictedDb()`.
- **Secrets.** Keep the Gemini key and model IDs in private `runtimeConfig` (e.g. `runtimeConfig.ai.{apiKey, model, sideModel}`), not `public`. Use `createGoogle({ apiKey })` (https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai, https://ai-sdk.dev/docs/getting-started/nuxt).
- **Zod.** Validate the request body (chat id, last message) with Zod 4. The AI SDK peers accept `^4.1.8` (npm).

## Version compatibility summary

| Package | Repo (locked) | Latest | Note |
| --- | --- | --- | --- |
| `nuxt` | 4.5.2 | 4.6.4 | ≥4.6.3 needed for `event.req.signal` abort on disconnect (https://github.com/nuxt/nuxt/releases/tag/v4.6.3) and for `@comark/nuxt@0.9`. Nuxt 4.6 requires Node 22.21+ (https://github.com/nuxt/nuxt/releases/tag/v4.6.0). Local Node is 22.21.1. |
| `@nuxt/ui` | 4.11.2 | 4.12.0 | Optional peer `ai ^6 \|\| ^7`. |
| `ai` | (none) | 7.0.165 | Node ≥22, ESM only. |
| `@ai-sdk/vue` | (none) | 4.0.165 | Peer `vue ^3.3.4` (repo has 3.5.43). |
| `@ai-sdk/google` | (none) | 4.0.114 | Peer zod (repo has 4.6.5). |
| `@comark/nuxt` | (none) | 0.9.0 | Pre-1.0. 0.9 peers `nuxt ^4.6.3`. |
| `shiki` | (none) | (template uses ^4.5.0) | For the Comark shiki plugin. |
| `@google/genai` | (none) | 3.0.0 | Not recommended. |

## Open questions for later tickets

- Should the Context Limit meter use per-turn `inputTokens` (context size) or cumulative `totalTokens` (cost)? That's the Context Limit ticket.
- Should titles be generated inline in the stream route, as the template does, or as a separate side job? That's the title ticket.
- Is `gemini-3.8-flash` (badged "New", stability not labelled) acceptable over `gemini-3.6-flash` (Stable)? Confirm when setting runtime config.
