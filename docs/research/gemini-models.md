# Gemini models, context windows, pricing and recall limits for Chat v1

Research for issue #2 (map: issue #1). Researched 2026-11-08 against Google's own docs, pricing pages and DeepMind model cards. Prices are USD per 1M tokens on the Gemini Developer API, paid Standard tier, unless noted. Each fact has a source link. Anything marked **(estimate)** or **(unverified)** is my inference, not something a source states.

## Answer in short

| | Main interviewer | Side jobs (titles, Continuation summaries) |
|---|---|---|
| Model ID | `gemini-3.8-flash` | `gemini-3.5-flash-lite` |
| Status | Stable (GA), released 2026-09-02 | Stable (GA), released 2026-07-21 |
| Context window / max output | 1,048,576 / 65,536 | 1,048,576 / 65,536 |
| Input / output / cached input | $0.75 / $3.75 / $0.075 until 2026-12-31, then **$1.50 / $7.50 / $0.15** from 2027-01-01 | $0.30 / $2.50 / $0.03 |
| Suggested product token budget | **64k tokens** (warn at ~51k), never more than 128k | n/a |

- "Gemini 3.8 Flash" is real. Its ID is exactly `gemini-3.8-flash`, it is GA, and there is no `-preview` suffix or dated alias. ([models](https://aistudio.google.com/docs/models/gemini-3.8-flash), [deprecations](https://aistudio.google.com/docs/deprecations))
- Plan costs on the **2027 price** ($1.50 / $7.50). The current price is an introductory rate that ends on 2026-12-31, before Chat v1 is likely to have real traffic. ([pricing](https://aistudio.google.com/docs/pricing), [what's new in 3.8](https://aistudio.google.com/docs/whats-new-gemini-3.8))

## 1. Current lineup (Gemini Developer API, as of 2026-11-08)

The [models page](https://aistudio.google.com/docs/models) lists these Flash-class text models. `ai.google.dev/gemini-api/docs/*` now 301-redirects to `aistudio.google.com/docs/*`.

| Model ID | Status | Released | Shutdown | Notes |
|---|---|---|---|---|
| `gemini-3.8-flash` | Stable, newest Flash | 2026-09-02 | None announced | Recommended main model |
| `gemini-3.7-flash` | Removed from AI Studio | 2026-08-13 | Endpoint stays up but routes to `gemini-3.8-flash` | Don't use |
| `gemini-3.6-flash` | Stable, "previous-generation" | 2026-07-21 | None announced on Gemini API. **Vertex retires it 2026-11-19** | Same price as 3.8 Flash, so no reason to pick it |
| `gemini-3.5-flash-lite` | Stable | 2026-07-21 | None announced | Recommended side-job model |
| `gemini-3.1-flash-lite` | Stable | 2026-05-07 | **2027-05-07**, replaced by `gemini-3.5-flash-lite` | Cheaper but being retired |
| `gemini-3-flash-preview` | Preview | 2025-12-17 | None announced, replacement `gemini-3.6-flash` | Don't use |
| `gemini-2.5-flash` | Deprecated | | Routes to `gemini-3.5-flash-lite` on 2026-12-01 | Don't use |
| `gemini-2.5-pro` | Deprecated | | Routes to `gemini-3.8-flash` on 2026-12-01 | Don't use |

Sources: [models](https://aistudio.google.com/docs/models), [deprecations](https://aistudio.google.com/docs/deprecations), [what's new in 3.6 / 3.5 Flash-Lite](https://aistudio.google.com/docs/whats-new-gemini-3.6), [Vertex model versions](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions).

The frontier model is `gemini-4-argon` ($2.00 / $10.00, rising to $4.00 / $20.00 on 2026-12-01, with no explicit caching) ([pricing](https://aistudio.google.com/docs/pricing), [caching](https://aistudio.google.com/docs/caching)). It is out of scope for a value-first interviewer.

### `gemini-3.8-flash`

- Input limit 1,048,576 tokens, output limit 65,536. Text, image, video, audio and PDF in, text out. Latest update September 2026. ([model page](https://aistudio.google.com/docs/models/gemini-3.8-flash))
- Supports Batch API, caching, function calling, structured outputs, thinking, Search grounding and URL context. No Live API. ([model page](https://aistudio.google.com/docs/models/gemini-3.8-flash))
- Thinking levels are `low`, `medium` (default) and `high`. `minimal` returns an error. ([what's new in 3.8](https://aistudio.google.com/docs/whats-new-gemini-3.8), [Vertex model page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash))
- `temperature`, `top_p` and `top_k` are deprecated. The 3.8 migration checklist says to remove them. ([what's new in 3.8](https://aistudio.google.com/docs/whats-new-gemini-3.8))
- Google says the model "can use more tokens on longer running and complex tasks, by design", so thinking adds to output cost. ([what's new in 3.8](https://aistudio.google.com/docs/whats-new-gemini-3.8))
- Also on Vertex AI as `gemini-3.8-flash`: GA from 2026-09-02, retirement "September 2, 2027 or later", `global` endpoint plus `us` and `eu` multi-regions, implicit and explicit caching. ([Vertex model page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash), [Vertex model versions](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions))

### `gemini-3.5-flash-lite`

- Input limit 1,048,576, output limit 65,536. Google describes it as "optimized for high-throughput, low-cost execution for subagent tasks and document parsing". ([model page](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite))
- Default thinking level is `minimal`. ([what's new in 3.6](https://aistudio.google.com/docs/whats-new-gemini-3.6))
- Knowledge cutoff March 2026. ([model card](https://deepmind.google/models/model-cards/gemini-3-5-flash-lite/))
- Why not `gemini-3.1-flash-lite`? It is cheaper ($0.25 / $1.50) but shuts down on 2027-05-07 ([deprecations](https://aistudio.google.com/docs/deprecations)). It also recalls worse: MRCR 128k 60.1% against 72.2% ([3.5 Flash-Lite card](https://deepmind.google/models/model-cards/gemini-3-5-flash-lite/)). Summaries of long Chats need good recall.

## 2. Pricing

All from the [pricing page](https://aistudio.google.com/docs/pricing). The page labels the output row "Output price (including thinking tokens)", so thinking tokens are billed at the output rate.

| Model | Input | Output (incl. thinking) | Context caching | Cache storage | Batch in / out |
|---|---|---|---|---|---|
| `gemini-3.8-flash` to 2026-12-31 | $0.75 | $3.75 | $0.075 | $0.50 / 1M tokens / hr | $0.375 / $1.875 |
| `gemini-3.8-flash` from 2027-01-01 | **$1.50** | **$7.50** | **$0.15** | $1.00 / 1M tokens / hr | $0.75 / $3.75 |
| `gemini-3.6-flash` | Same as 3.8 Flash on the pricing page | | | | |
| `gemini-3.5-flash-lite` | $0.30 | $2.50 | $0.03 | $1.00 / 1M tokens / hr | $0.15 / $1.25 |
| `gemini-3.1-flash-lite` | $0.25 | $1.50 | $0.025 | $1.00 / 1M tokens / hr | $0.125 / $0.75 |

- 3.8 Flash has one flat rate with no >200k-prompt tier. Only 3.1 Pro and 2.5 Pro have that tier. ([pricing](https://aistudio.google.com/docs/pricing))
- The 3.8 Flash price is introductory. Google's eval PDF says: "For 3.7 and 3.8 Flash, introductory price expires on December 31, 2026. Starting January 1, 2027, $1.50/1M input tokens and $7.50/1M output tokens will apply." ([3.8 Flash evaluation PDF](https://storage.googleapis.com/deepmind-media/gemini/gemini_3-8_flash_model_evaluation.pdf), [what's new in 3.8](https://aistudio.google.com/docs/whats-new-gemini-3.8))
- There is a small inconsistency on 3.6 Flash. The what's-new page says $1.50 / $7.50 ([what's new in 3.6](https://aistudio.google.com/docs/whats-new-gemini-3.6)), but the pricing page shows the same intro-then-standard schedule as 3.8. It doesn't affect the recommendation.
- All of these models have a free tier, but on the free tier Google may use the data "to improve our products". On paid Standard, Batch, Flex and Priority it does not. ([pricing](https://aistudio.google.com/docs/pricing)) Production traffic, including Guests, should go through a billed project.

## 3. Context caching

- **Implicit caching** is "enabled by default for all Gemini 2.5 and newer models". You configure nothing, and "we automatically pass on cost savings if your request hits caches". ([caching](https://aistudio.google.com/docs/caching))
- The minimum prompt size for an implicit cache hit is **4,096 tokens** on 3.8 Flash and 3.6 Flash. The page doesn't list a minimum for 3.5 Flash-Lite or 3.1 Flash-Lite. ([caching](https://aistudio.google.com/docs/caching))
- To get more hits, put the large shared content first (system prompt, Build Brief, then older Messages) and send requests with the same prefix close together in time. ([caching](https://aistudio.google.com/docs/caching)) A chat that resends its full history every turn naturally has a stable growing prefix.
- The docs don't state a discount percentage. The cached rate is 10% of the input rate ($0.075 against $0.75), so an implicit hit probably bills at about 90% off input. **(estimate: the pricing page doesn't say the caching row covers implicit hits)**
- **Explicit caching** (you create the cache objects) works on 3.x Flash through `generateContent`. It is not supported in the Interactions API or on Gemini 4 Argon and later. ([caching](https://aistudio.google.com/docs/caching)) Storage is billed per hour ([pricing](https://aistudio.google.com/docs/pricing)). Chat v1 doesn't need it, because implicit caching covers the growing-history pattern.

## 4. How usage is reported per call

**`generateContent` / `streamGenerateContent`** returns `usageMetadata` ([API reference](https://aistudio.google.com/api-reference/generate-content)):

- `promptTokenCount`: the whole prompt, including cached tokens
- `cachedContentTokenCount`: the cached part of the prompt
- `candidatesTokenCount`: the visible output
- `thoughtsTokenCount`: thinking tokens
- `toolUsePromptTokenCount`: tool-use prompt tokens
- `totalTokenCount`: prompt + tool-use prompt + thoughts + candidates
- `serviceTier`: `standard`, `flex` or `priority`

**Interactions API** returns `usage` with `total_input_tokens`, `total_output_tokens`, `total_thought_tokens`, `total_cached_tokens`, `total_tool_use_tokens` and `total_tokens` ([tokens](https://aistudio.google.com/docs/tokens)). When streaming, final usage arrives on the `interaction.completed` event ([streaming](https://aistudio.google.com/docs/streaming)).

**`countTokens`** counts input tokens before you send a request ([tokens](https://aistudio.google.com/docs/tokens)).

Which chunk of a `streamGenerateContent` stream carries `usageMetadata` is not documented on the pages I read. **(unverified)** Confirm it in a prototype before building the Context Limit meter on it.

For the Context Limit meter, the context size after a turn is about `promptTokenCount + candidatesTokenCount`, which is the next turn's prompt. Thinking tokens are billed but are not part of the history you resend. **(estimate: check how thought signatures count once they are passed back)**

## 5. Rate limits

- RPM, TPM and RPD for these models are **not published**. The docs say they "can be viewed in Google AI Studio". Limits apply per project, not per API key. ([rate limits](https://aistudio.google.com/docs/rate-limits))
- How you reach each tier ([rate limits](https://aistudio.google.com/docs/rate-limits)):
  - Free: an active project
  - Tier 1: a linked billing account
  - Tier 2: $100 paid and 3 days since the first payment
  - Tier 3: $1,000 paid and 30 days
- Batch enqueued-token limits ([rate limits](https://aistudio.google.com/docs/rate-limits)):

| Model | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| `gemini-3.8-flash` | 3M | 400M | 1B |
| `gemini-3.5-flash-lite` | 10M | 500M | 1B |

- Implication: the daily message caps in v1 are our own product guardrail. Read the project's actual RPM and TPM from AI Studio once billing is linked.

## 6. Evidence on long-context recall

### Google's own numbers (GDM-MRCR v2, 8-needle multi-round coreference)

| Model | 128k (average) | 1M (pointwise) | Source |
|---|---|---|---|
| Gemini 3.7 Flash (3.8 Flash "is based on" it) | 97.0% | not reported | [3.7 Flash card](https://deepmind.google/models/model-cards/gemini-3-7-flash/) |
| Gemini 3.6 Flash | 91.8% | 54.0% | [3.6 Flash card](https://deepmind.google/models/model-cards/gemini-3-6-flash/) |
| Gemini 3.5 Flash | 77.3% | 26.6% | [3.6 Flash card](https://deepmind.google/models/model-cards/gemini-3-6-flash/) |
| Gemini 3.1 Pro | 84.9% | 26.3% | [3.6 Flash card](https://deepmind.google/models/model-cards/gemini-3-6-flash/) |
| Gemini 3.5 Flash-Lite | 72.2% | 21.3% | [3.5 Flash-Lite card](https://deepmind.google/models/model-cards/gemini-3-5-flash-lite/) |
| Gemini 3.1 Flash-Lite | 60.1% | 12.3% | [3.5 Flash-Lite card](https://deepmind.google/models/model-cards/gemini-3-5-flash-lite/) |

- **Google has published no MRCR score for 3.8 Flash.** The 3.8 Flash card says the model "is based on Gemini 3.7 Flash" and points to the 3.7 card for limitations ([3.8 Flash card](https://deepmind.google/models/model-cards/gemini-3-8-flash/)). The 3.8 evaluation methodology describes GDM-MRCR v2 "includes 128k results as a cumulative score", but the results table leaves it out. The only long-context row is LVBench (video) at 87.8% ([3.8 Flash evaluation PDF](https://storage.googleapis.com/deepmind-media/gemini/gemini_3-8_flash_model_evaluation.pdf)). The 3.7 Flash figure is the best available proxy.
- The "128k average" score is cumulative over lengths up to 128k. It is not a score at exactly 128k ([3.8 Flash evaluation PDF](https://storage.googleapis.com/deepmind-media/gemini/gemini_3-8_flash_model_evaluation.pdf)). At 1M, recall roughly halves even on the best Flash model with a published number (54.0% for 3.6 Flash).
- Google's long-context guide says single-needle recall is high, but "the model does not perform with the same accuracy" with multiple needles, and performance "can vary to a wide degree depending on the context". It recommends putting the query at the end of a long prompt. ([long context](https://aistudio.google.com/docs/long-context))

### Independent studies (older models, but the pattern holds)

- **Chroma, "Context Rot" (2025-07-14).** The study tested 18 models, including Gemini 2.5 Pro and Flash, and found "performance grows increasingly unreliable as input length grows". On LongMemEval, conversational memory scored much higher with focused prompts (~300 tokens) than with the full ~113k-token history, across every model. ([Chroma](https://www.trychroma.com/research/context-rot))
- **NoLiMa (ICML 2025).** This study removes literal keyword overlap between the question and the needle. With that, 11 of 13 models claiming 128k+ context fell below 50% of their short-context score by **32k tokens** ([arXiv 2502.05167](https://arxiv.org/abs/2502.05167)). Interview recall is this kind of task: the user stated a budget 40 turns ago, in different words.
- **"LLMs Get Lost in Multi-Turn Conversation" (2025).** Multi-turn performance averaged a 39% drop compared with single-turn, mostly from unreliability rather than lost ability: models "make assumptions in early turns" and "do not recover" ([arXiv 2505.06120](https://arxiv.org/abs/2505.06120)). This supports keeping the Build Brief as the source of truth rather than trusting raw history.

### Where quality falls (synthesis)

- On Google's multi-needle benchmark, current Flash models hold above 90% up to 128k, then drop sharply toward 1M.
- Independent studies of harder tasks without literal matches show degradation starting around 32k.
- No source gives one exact cliff for 3.8 Flash.

**Suggested recall-safe range: 32k–100k tokens of Chat history. Default product budget 64k (warn at ~51k, block at 64k). Hard ceiling 128k.** **(estimate)** The Build Brief carries the important facts across a Continuation, so a modest budget costs little. Run the canary prototype from the map at 32k, 64k and 100k to set the final number.

## 7. Cost of one interview turn

**(estimate)** Assumptions:

- The whole history is resent as input each turn.
- About 1,500 output tokens per turn (visible reply plus `medium` thinking).
- "Cached" means everything except the newest ~1k tokens hits the implicit cache, billed at the context-caching rate.
- Prices are from the [pricing page](https://aistudio.google.com/docs/pricing).

| History | Intro 2026, uncached | Intro 2026, cached | **2027 standard, uncached** | **2027 standard, cached** |
|---|---|---|---|---|
| 10k | $0.013 | $0.007 | **$0.026** | **$0.014** |
| 50k | $0.043 | $0.010 | **$0.086** | **$0.020** |
| 64k | $0.054 | $0.011 | **$0.107** | **$0.022** |
| 100k | $0.081 | $0.014 | **$0.161** | **$0.028** |

- **Whole Chat:** growing to 100k at about 1.5k tokens per turn takes ~67 turns. That totals about **$5.80 uncached or $1.35 fully cached at 2027 prices**, and half that before 2027. Capping at 64k (~43 turns) cuts this to about $2.50 uncached. **(estimate)**
- **Side jobs on `gemini-3.5-flash-lite`:**
  - A Continuation summary of a 64k Chat with ~2k output costs about $0.02 ($0.019 input + $0.005 output).
  - A title from ~1k input tokens costs about $0.0003.

## Open questions for later tickets

- Which `streamGenerateContent` chunk carries `usageMetadata`. Interactions API streaming puts it on `interaction.completed`.
- Whether implicit cache hits bill at the listed context-caching rate, and how often they hit in practice. Measure `cachedContentTokenCount` in the prototype.
- Thinking level for the interviewer: `low` would cut output cost, `medium` is the default. Compare in the eval harness.
- `generateContent` or the Interactions API. Google's newer docs lead with Interactions, and explicit caching only works on `generateContent`.
