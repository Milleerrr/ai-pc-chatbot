# How interview agents keep a structured record up to date

Research for [#6](https://github.com/Milleerrr/ai-pc-chatbot/issues/6), part of map [#1](https://github.com/Milleerrr/ai-pc-chatbot/issues/1). Feeds the prototype in [#10](https://github.com/Milleerrr/ai-pc-chatbot/issues/10).

Researched 2026-11-08. The record in question is the **Build Brief**: what the interview has established about the user's needs, plus what is still unknown (see `CONTEXT.md`). The model is Gemini Flash, probably through the Vercel AI SDK.

Sections 1 to 4 are **documented facts**, each with a source. Section 5 is **opinion**: my reading of those facts for this project. Things I could not confirm are in section 6.

## TL;DR

- Production systems use two placements for record updates: **in the hot path** (the agent calls a tool during its reply turn) or **in the background** (a separate pass after the turn). LangChain's memory docs set out the trade-off: the hot path gives immediate updates at the cost of latency and of the agent multitasking. Background passes cost no reply latency, but the record can be stale.
- They use two update shapes: **regenerate the whole document** or **emit small edits** (JSON Patch, `set slot` commands, ADD/UPDATE/DELETE). Sources agree that regenerating a growing document risks silently dropping fields. Edits keep the output small and make a correction just another `set`.
- Gemini limits that matter: schemas compile to a state machine with size, branching and nesting limits (`400 INVALID_ARGUMENT` when exceeded). Some JSON Schema keywords are not enforced. Google recommends at most 10 to 20 active tools. Tool arguments can stream. Structured output combined with tools is **Preview, Gemini 3 series only**. In the AI SDK, `generateObject`/`streamObject` are deprecated in favour of `generateText`/`streamText` with `output: Output.object(...)`.
- Two approaches worth prototyping in #10 (opinion):
  - **A:** an in-turn `update_brief` tool that takes field-level edits, inside the interviewer's `streamText` loop.
  - **B:** a separate extraction pass on a cheaper model (Gemini 3.5 Flash-Lite) that returns field-level edits through `Output.object`.

  In both, the server applies the edits, and the next question is chosen from the Brief's unknown fields, which go into the prompt each turn.

## 1. Patterns in production systems

### 1.1 Hot path vs background

LangChain's long-term memory docs name the two placements ([LangChain: Memory](https://docs.langchain.com/oss/python/concepts/memory)):

- **Hot path.** It "allows for real-time updates, making new memories immediately available for use in subsequent interactions", and "users can be notified when memories are created and stored". Costs:
  - "the process of reasoning about what to save to memory can impact agent latency"
  - "It may increase complexity if the agent requires a new tool to decide what to commit to memory"
  - "the agent must multitask between memory creation and its other responsibilities"
- **Background.** It "eliminates latency in the primary application" and "separates application logic from memory management", which allows "more focused task completion". Costs: "infrequent updates may leave other threads without new context", and choosing the update frequency "becomes crucial".

Mem0 is a background-style pipeline with published numbers ([Mem0 paper, arXiv 2504.19413](https://arxiv.org/html/2504.19413)):

- **Extraction phase.** After each new message pair, an LLM extracts candidate facts. Its input is the new pair, a stored conversation summary (refreshed by a separate asynchronous module) and the last *m* = 10 messages.
- **Update phase.** Each candidate is compared with similar existing memories. The LLM then picks **ADD / UPDATE / DELETE / NOOP** through a function-calling interface: "Rather than using a separate classifier, we leverage the LLM's reasoning capabilities." DELETE handles contradictions.
- **Results.** Against full-context answering, Mem0 reports "91% lower p95 latency" and "more than 90% token cost" saved. Accuracy is about 6 points lower (J 66.88% vs 72.90%).

Anthropic calls the agent-writes-its-own-notes pattern "structured note-taking": "the agent regularly writes notes persisted to memory outside of the context window", which "provides persistent memory with minimal overhead" ([Anthropic: Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)).

### 1.2 Slot-filling intake (Rasa CALM)

Rasa CALM is a production slot-filling framework. It splits understanding from dialogue logic:

- An LLM "command generator" outputs "a sequence of commands that represent how the user wants to progress the conversation", such as `start flow`, `set slot slot_name slot_value` and `cancel flow` ([Rasa: LLM command generators](https://rasa.com/docs/reference/config/components/llm-command-generators)).
- **Corrections use the same command.** `set slot` "can be used to correct and change previously set values" ([same page](https://rasa.com/docs/reference/config/components/llm-command-generators)).
- The prompt includes the active flow, the requested slot, and each slot's current value, type, description and allowed values ([same page](https://rasa.com/docs/reference/config/components/llm-command-generators)).
- `from_llm` slots can be filled "at any point in the conversation flow", not only when that slot is being asked about ([Rasa: Slots](https://rasa.com/docs/reference/primitives/slots)).
- **What to ask next is deterministic.** "By default, a collect step is skipped if the corresponding slot is already filled", and `ask_before_filling: true` forces the question ([Rasa: Flow steps](https://rasa.com/docs/reference/primitives/flow-steps/)). Rasa's Mantle templates add an "Already collected (do not re-ask)" notice when a collect step is skipped, and tell the model to call `correct` if the user changes a value ([Rasa Mantle: Prompt templates](https://rasa.com/docs/mantle/reference/prompt-templates)).

### 1.3 Whole document vs edits

- **Profile (one JSON document).** LangChain notes that it "can be become error-prone as the profile gets larger". The model can produce "a new profile (or some JSON patch to apply to the old profile)". Recommended mitigations are "splitting a profile into multiple documents or strict decoding" ([LangChain: Memory](https://docs.langchain.com/oss/python/concepts/memory)).
- **Collection (many small items).** It gives "higher recall downstream", but "The model must now delete or update existing items", and "some models may default to over-inserting and others may default to over-updating" ([LangChain: Memory](https://docs.langchain.com/oss/python/concepts/memory)).
- **Trustcall.** LangChain's library asks the LLM for JSON Patch operations rather than full objects. It says LLMs "struggle when asked to generate or modify large JSON blobs", and that on updates "it's still **too easy** for LLMs to 'accidentally' omit information". Its own example shows a naive full update dropping a field. Patching lets the model "focus on what has changed", and is "cheaper since you only regenerate a subset of the full schema" ([trustcall README](https://github.com/hinthornw/trustcall)). These claims are qualitative: the README publishes no benchmark numbers.
- **JSON Patch (RFC 6902)** defines `add`, `remove`, `replace`, `move`, `copy` and `test`. If an operation fails, "application of the entire patch document SHALL NOT be deemed successful" ([RFC 6902](https://www.rfc-editor.org/rfc/rfc6902)).

## 2. Gemini facts and limits

All from Google's docs. They moved from `ai.google.dev` to `aistudio.google.com`, and the old URLs redirect.

### 2.1 Models and price

- **Gemini 3.8 Flash** (`gemini-3.8-flash`) is the newest Flash model. **Gemini 3.5 Flash-Lite** (`gemini-3.5-flash-lite`) is the recommended Flash-Lite. Gemini 2.5 Flash is deprecated and routes to 3.5 Flash-Lite from 2026-12-01 ([Gemini models](https://aistudio.google.com/docs/models)).
- **3.8 Flash specs.** Input limit 1,048,576 tokens, output limit 65,536. It supports function calling, structured outputs and caching. Thinking: "Supported (low, medium, high)", and "`minimal` is not supported and returns an error" ([Gemini 3.8 Flash](https://aistudio.google.com/docs/models/gemini-3.8-flash)).
- **Paid-tier prices** per 1M tokens ([Gemini pricing](https://aistudio.google.com/docs/pricing)):
  - 3.8 Flash: $0.75 input and $3.75 output until 2026-12-31, then **$1.50 and $7.50 from 2027-01-01**. Cached input is $0.075, then $0.15.
  - 3.5 Flash-Lite: $0.30 input, $2.50 output, $0.03 cached.
  - Output prices include thinking tokens.

### 2.2 Function calling

From [Gemini function calling](https://aistudio.google.com/docs/function-calling) and the [API reference](https://aistudio.google.com/api-reference/caching):

- **Modes:**
  - `AUTO` (default): the model decides between a call and text.
  - `ANY`: "constrained to always predicting a function call only", optionally limited by `allowedFunctionNames`.
  - `NONE`.
  - `VALIDATED`: the model "decides to predict either a function call or a natural language response, but will validate" calls with constrained decoding.
- **Several calls per turn.** Parallel calls ("multiple functions in a single turn") and compositional (chained) calls are supported.
- **Tool count.** "Keep active set to 10-20 tools maximum."
- **Schema limits.** "Only a subset of the OpenAPI schema is supported." Separately, `parametersJsonSchema` accepts JSON Schema and cannot be combined with `parameters`. "For `any` mode, very large or deeply nested schemas may be rejected". If the combined tool complexity exceeds the state-machine limits, the API returns `400 INVALID_ARGUMENT`.
- **Streaming.** "Tool arguments can be streamed as partial arguments … You must aggregate these deltas to reconstruct the complete tool calls before executing them." The page's Python and JS samples use different delta names. The generateContent API reference does not document a partial-arguments field, so this may be an Interactions-API-only feature (see section 6).
- **Thinking.** Gemini 3 models think, which "improves function calling". "The SDKs automatically handle thought signatures for you."

### 2.3 Structured output

From [Gemini structured outputs](https://aistudio.google.com/docs/structured-output):

- **Supported JSON Schema subset:**
  - Types: `string`, `number`, `integer`, `boolean`, `object`, `array`, and `null` via type arrays.
  - Object keywords: `properties`, `required`, `additionalProperties`.
  - String keywords: `enum`, and `format` (`date-time`, `date`, `time`).
  - Number keywords: `enum`, `minimum`, `maximum`.
  - Array keywords: `items`, `prefixItems`, `minItems`, `maxItems`.
- **Not enforced** (stripped silently, so validate in the app): `minLength`/`maxLength`, `minProperties`/`maxProperties`, `uniqueItems`, `contains` and related.
- **Size limit.** Schemas compile to a state machine "with limits on total states, branching paths, and nesting depth". Exceeding them returns `400 INVALID_ARGUMENT`. Google's fixes: flatten nesting; use fewer optional fields, enums and `anyOf` branches; use shorter property names; move rules into descriptions.
- **Streaming.** "The streamed chunks are valid partial JSON."
- **Combined with tools.** Structured output plus tools (including function calling) is **Preview, Gemini 3 series only**. The function-calling page says: "For Gemini 3 series models, combine function calling with structured output for consistently formatted responses" ([function calling](https://aistudio.google.com/docs/function-calling)).
- **Validity.** Output is syntactically valid JSON "but not necessarily semantically correct", so validate it with Zod or similar.

## 3. Vercel AI SDK facts

- **Deprecated APIs.** "`generateObject` and `streamObject` have been deprecated … Use `generateText` and `streamText` with an `output` setting instead." Streaming structured data uses `partialOutputStream` ([AI SDK 6 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0)).
- **Structured output with tools.** They work in one call, but "Structured output generation counts as a step", so `stopWhen` must allow enough steps ([Generating structured data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)).
- **Errors.** A response that fails the schema throws `NoObjectGeneratedError`. Reading `result.output` after a step that ended on `tool-calls` throws `NoOutputGeneratedError` ([same page](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)).
- **Tool APIs** ([Tools and tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)):
  - Tools are defined with `tool({ description, inputSchema, execute })`.
  - Multi-step loops are controlled by `stopWhen` (default `isStepCount(1)`).
  - `toolChoice` is `auto` | `required` | `none` | `{ type: 'tool', toolName }`.
  - `prepareStep` can change `model`, `toolChoice`, `activeTools`, `messages` and `instructions` before each step.
  - `onStepEnd` fires after each step.
  - `repairToolCall` fixes invalid tool calls.
  - With per-tool `strict: true`, supporting providers "will only generate tool calls that are valid according to your defined `inputSchema`".
  - Tool input streaming goes through `onInputStart` / `onInputDelta` (the latter only with `streamText`).
- **Google provider** ([@ai-sdk/google](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai)):
  - `structuredOutputs` defaults to true, and "for tool calling they are required".
  - Large or nested schemas can fail with "Request contains an invalid argument". The workaround is to simplify the schema or disable `structuredOutputs`, in which case the SDK still validates.
  - Gemini 3 uses `thinkingLevel`.
  - The capability table marks Object Generation, Tool Usage and Tool Streaming as supported for every Gemini 3.x Flash model, `gemini-3.8-flash` included.

## 4. Trade-off table

The rows restate the facts above. Cells marked *(opinion)* are my inference.

| | In-turn tool call | Separate extraction pass |
|---|---|---|
| Brief freshness for the next question | Updated before the reply text when the tool runs first ([LangChain](https://docs.langchain.com/oss/python/concepts/memory): "immediately available") | Lags one turn if run after the reply. Run before the reply, it adds a full call to time-to-first-token *(opinion)* |
| Reply latency | Reasoning about what to save "can impact agent latency" ([LangChain](https://docs.langchain.com/oss/python/concepts/memory)). Each extra step re-sends the context ([AI SDK steps](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)) | None if run after the reply ([LangChain](https://docs.langchain.com/oss/python/concepts/memory): "eliminates latency") |
| Reliability | Agent "must multitask" ([LangChain](https://docs.langchain.com/oss/python/concepts/memory)). In `AUTO` the model may skip the call ([Gemini modes](https://aistudio.google.com/api-reference/caching)) | "more focused task completion" ([LangChain](https://docs.langchain.com/oss/python/concepts/memory)). Can use strict structured output ([Gemini](https://aistudio.google.com/docs/structured-output)) |
| Cost | One model, but extra steps re-bill input. Cached input is 10% of the input price ([pricing](https://aistudio.google.com/docs/pricing)) | Extra call, but can run on Flash-Lite at $0.30/$2.50 vs $0.75/$3.75 ([pricing](https://aistudio.google.com/docs/pricing)) |
| Corrections | Same `set` edit overwrites the field *(opinion, mirrors [Rasa](https://rasa.com/docs/reference/config/components/llm-command-generators))* | Same. The extractor sees the current Brief plus the new exchange, like Mem0's UPDATE/DELETE ([Mem0](https://arxiv.org/html/2504.19413)) |
| Live panel UX | Tool args can stream ([Gemini](https://aistudio.google.com/docs/function-calling), [AI SDK](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)) | Panel updates after the reply finishes *(opinion)* |

## 5. Recommendation (opinion)

1. **Use edits, not whole-Brief regeneration.**
   - Give the Brief a flat, fixed set of fields. Each field holds a value plus a status such as `known` / `assumed` / `unknown` / `not_needed`.
   - The model emits a list of `{ field, op: 'set' | 'clear', value, status }` with `field` as an **enum**. Raw RFC 6902 pointers would be free-text strings the schema cannot constrain.
   - The server validates and applies the edits atomically (as in RFC 6902) and keeps an edit log per Build, which records the history when the user corrects themselves.
   - Why: this avoids the information-loss failure (trustcall, LangChain), keeps output tokens small, and keeps the schema well inside Gemini's state-machine limits. The field list itself comes from #7.
2. **The next question should come from code, not memory.** Each turn, inject the current Brief plus its `unknown` fields into the interviewer prompt, with "already known, do not re-ask" wording, as Rasa does. The model chooses phrasing and order, and the Brief is the single source of what is still missing. This also makes the Brief completeness check from #7 a pure function.
3. **Prototype these two in #10:**
   - **A. In-turn tool.** `streamText` with one `update_brief` tool (`execute` applies edits) and `stopWhen: isStepCount(2–3)`. Variant to test: force the tool on step 0 with `prepareStep` returning `toolChoice: 'required'`, then `'none'` on step 1. This guarantees an update every turn, at the cost of one extra round-trip before text. Measure whether plain `auto` skips updates too often.
   - **B. Extraction pass.** After the reply streams, call `generateText({ model: gemini-3.5-flash-lite, output: Output.object({ schema: briefEdits }) })` with the current Brief plus the last user/assistant pair. Variant to test: run it *before* the reply, so the interviewer always sees a fresh Brief, and measure the time-to-first-token cost.
   - Judge both on the #10 criteria: correctness, corrections ("actually make that 1440p"), latency, and tokens per turn from provider-reported usage.
4. **Not recommended for v1:**
   - Whole-Brief regeneration each turn: it risks information loss, and output cost grows with the Brief.
   - A collection-of-facts store with vector retrieval (Mem0-style): the Brief is one small, fixed-shape document per Build, so retrieval adds complexity for no recall gain.
   - Relying on the Preview "structured output + tools in one call" feature.

## 6. Open questions / not confirmed

- **Does `@ai-sdk/google` map per-tool `strict: true` to Gemini's `VALIDATED` mode?** Neither doc says. Check the provider source during #10.
- **Do partial tool-argument deltas work through the AI SDK on `generateContent`?** Google documents streamed arguments on the Interactions API page, and the AI SDK table marks "Tool Streaming" as supported. The generateContent API reference has no partial-args field. Confirm empirically before designing a live-streaming Brief panel around it.
- **Which thinking levels does 3.8 Flash accept?** The AI SDK provider page says "Gemini 3 Flash supports all four levels" including `minimal`. Google's 3.8 Flash page says `minimal` "returns an error". Use `low` for the extractor.
- **The 3.8 Flash price doubles on 2027-01-01.** That makes Approach B (Flash-Lite) relatively more attractive. Re-check pricing when the PRD is written.
- **Trustcall's reliability claims** and the Mem0 numbers come from their own authors and are not independently replicated.
