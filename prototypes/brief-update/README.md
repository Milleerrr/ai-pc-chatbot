# PROTOTYPE: Build Brief update mechanism (throwaway)

Wayfinder ticket: "How does the Build Brief get updated during a Chat?" Never merged to main.

Compares an in-turn `update_brief` tool (A-auto, A-forced) with a separate Flash-Lite extraction pass (B-post, B-pre).

Run (needs `GEMINI_API_KEY` in the repo-root `.env`, billing enabled):

    pnpm install --ignore-workspace
    npx tsx --env-file=../../.env run.ts --variants B-post --scenarios S1,S2,S3 --runs 1

Models: main `gemini-3.8-flash`, side `gemini-3.5-flash-lite` (override with MAIN_MODEL / SIDE_MODEL).

Verdict: B-post. See `results/` for the 2026-11-08 run (all variants 24/24 on fields, 2/2 on corrections; B-post had the fastest first text and the fewest tokens).
`brief.ts` is the portable part: field list, edit schema, `applyEdits` rules.
