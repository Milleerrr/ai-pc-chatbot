// Drives each variant like the browser would: start streaming, read for a bit, abort (= Stop), then watch server logs.
import { readFileSync, existsSync } from "node:fs";
import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import type { AppRouter } from "./server/trpc";

const BASE = process.env.BASE ?? "http://localhost:3100";
const [kind, variant, readMs = "3000", waitMs = "30000"] = process.argv.slice(2);
const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
const tag = `${kind}-${variant}-${run}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ac = new AbortController();
let got = 0;

async function go() {
  if (kind === "nitro") {
    const res = await fetch(`${BASE}/api/nitro/${variant}?run=${run}`, { signal: ac.signal });
    const reader = res.body!.getReader();
    for (;;) { const { done, value } = await reader.read(); if (done) break; got += value.length; }
  } else {
    const client = createTRPCClient<AppRouter>({ links: [httpBatchStreamLink({ url: `${BASE}/api/trpc` })] });
    const it = await client.stream.query({ variant: variant as any, run }, { signal: ac.signal });
    for await (const c of it) got += (c as string).length;
  }
}
const p = go().catch((e) => console.log("client ended:", e?.name ?? e, e?.message ?? "", e?.cause ?? ""));
await sleep(Number(readMs));
console.log(`[${tag}] client received ${got} bytes; pressing STOP`);
const stopAt = Date.now();
ac.abort();
await p;
await sleep(Number(waitMs));
const lines = readFileSync("logs/server.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((l) => l.run.endsWith(run));
console.log(`--- server events for ${tag} (t relative to Stop, ms) ---`);
for (const l of lines) { const { t, run: _r, evt, ...rest } = l; console.log(String(t - stopAt).padStart(7), evt, JSON.stringify(rest)); }
