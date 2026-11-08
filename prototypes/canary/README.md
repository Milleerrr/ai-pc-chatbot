# PROTOTYPE: hidden canary vs recall loss in long Chats (throwaway)

Wayfinder ticket: "Does a hidden canary phrase track recall loss in long Chats?" Never merged to main.

One scripted PC-building Chat on `gemini-3.8-flash` (`low` thinking, canary rule in the system prompt). Facts are planted at turns 1-3 and 12, then pasted spec lists pad the context. Every live turn records whether the reply opens with the canary. At checkpoints the history is forked and a probe asks for the planted facts plus a CPU pick, with the canary kept in or stripped from past replies.

Run (needs `GEMINI_API_KEY` in the repo-root `.env`, billing enabled; about $2.4 at intro rates):

    pnpm install --ignore-workspace
    npx tsx --env-file=../../.env run.ts --samples 3 --cap 7

Verdict: no signal inside the 128k budget. Canary present 22/22 live turns (to 131k) and 36/36 probes (to 103k); recall of every planted fact and the non-Intel pick were 100% in every probe; keeping or stripping the canary in history made no difference.
Not covered: the run died at the 128k probe on Gemini's 2M input-tokens/minute limit (six parallel probes), so probes stop at 103k and nothing was tested past 131k. `run.ts` now throttles probes and saves history. `results/run.log` has the full run; the JSON stops at the 103k checkpoint.
`strip.ts` is the portable part: a streaming canary stripper, self-checked with `npx tsx strip.ts`.
