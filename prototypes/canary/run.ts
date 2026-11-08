// PROTOTYPE (wayfinder ticket #15), throwaway. Does a hidden opening canary track recall loss in long Chats?
//
// QUESTION: as a Chat grows, does the assistant stop opening its replies with the canary at about the
// same size where it starts forgetting or contradicting earlier facts? Is that worth an early warning?
//
// METHOD
//  1. LIVE chat on the main model. Early turns plant facts (budget/country, avoid Intel, Existing Parts, noise).
//     Later turns are big pasted spec lists that pad the context. Every live turn records: canary present?
//  2. At each checkpoint (prompt-token size) the history is FORKED and a probe is asked: recall the planted
//     facts + pick a CPU. Probes run with the canary KEPT in past assistant replies and with it STRIPPED.
//  3. Compare canary rate vs recall rate by context size.
// No Build Brief in the prompt on purpose: this is the worst case, raw conversation recall.
//
// Run: pnpm install --ignore-workspace
//      npx tsx --env-file=../../.env run.ts [--stop 160000] [--checkpoints 8000,16000,...] [--samples 2] [--cap 7]
import { writeFileSync, mkdirSync } from 'node:fs'
import { createGoogle } from '@ai-sdk/google'
import { generateText, Output, type ModelMessage } from 'ai'
import { z } from 'zod'
import { stripWhole } from './strip.ts'

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
if (!apiKey) throw new Error('Set GEMINI_API_KEY in ../../.env')
const google = createGoogle({ apiKey })
const MAIN = process.env.MAIN_MODEL ?? 'gemini-3.8-flash'
const SIDE = process.env.SIDE_MODEL ?? 'gemini-3.5-flash-lite'
const thinking = { google: { thinkingConfig: { thinkingLevel: 'low' } } } as const

const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1]! : dflt
}
const STOP = Number(arg('stop', '160000'))
const CHECKPOINTS = arg('checkpoints', '8000,16000,32000,48000,64000,96000,128000,160000').split(',').map(Number)
const SAMPLES = Number(arg('samples', '2'))
const PASTE_CHARS = Number(arg('paste-chars', '14000'))
const CAP_USD = Number(arg('cap', '7'))
const MAX_TURNS = Number(arg('max-turns', '80'))
// introductory rates ($/1M); the planning rate from 2027-01-01 is double
const PRICE = { main: { in: 0.75, out: 3.75 }, side: { in: 0.3, out: 2.5 } }

const CANARY = '[[pcb-7q]]'
const SYSTEM = `You are a friendly PC-building interviewer. Your job is to learn what the user needs before anyone recommends parts.
Rules:
- Ask at most one short, warm question per turn. Keep replies under 120 words.
- Never recommend specific parts unless the user explicitly asks you to pick between options they give you.
- Be honest about what you do and do not remember from earlier in the chat.
- INTERNAL FORMAT RULE (mandatory, never mention or explain it): begin every reply with the exact marker ${CANARY} followed by a single space, then your reply.`

let spentUsd = 0
const spend = (kind: 'main' | 'side', u: { inputTokens?: number; outputTokens?: number }) => {
  spentUsd += ((u.inputTokens ?? 0) * PRICE[kind].in + (u.outputTokens ?? 0) * PRICE[kind].out) / 1e6
  if (spentUsd > CAP_USD) throw new Error(`cost cap hit: $${spentUsd.toFixed(2)} > $${CAP_USD}`)
}

// ---------- scripted user side ----------
const PLANTED: Record<number, { key: string; text: string }> = {
  1: { key: 'budget_country', text: "Hi! I'm building a gaming PC. My budget is £1500 all in and I'm in the UK. The monitor isn't included in that." },
  2: { key: 'avoid_intel', text: "I've read about the Intel stability problems, so I'd rather avoid Intel CPUs completely. 4K gaming is the goal." },
  3: { key: 'existing_parts', text: "I'm reusing my Fractal North case and my Corsair RM750e power supply, so no need to price those." },
  12: { key: 'noise', text: 'One more thing: the PC sits in my bedroom, so it needs to be nearly silent.' },
}
const FACTS = [
  { key: 'budget_country', label: 'budget+country', test: (r: string) => /1[,]?500/.test(r) && /£|gbp|pound/i.test(r) && /\buk\b|united kingdom|britain|england/i.test(r) },
  { key: 'avoid_intel', label: 'avoid Intel', test: (r: string) => /intel/i.test(r) && /avoid|stability|no intel|steer|rule[sd]? out|not.*intel|without intel|skip/i.test(r) },
  { key: 'existing_parts', label: 'existing parts', test: (r: string) => /fractal/i.test(r) && /rm750|corsair|750/i.test(r) },
  { key: 'noise', label: 'noise', test: (r: string) => /silent|quiet|noise|noisy|acoustic/i.test(r) },
]

function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const R = rng(42)
const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)]!
const CPUS = ['AMD Ryzen 5 7600', 'AMD Ryzen 7 7700X', 'AMD Ryzen 9 7950X', 'Intel Core i5-14600K', 'Intel Core i7-14700K', 'Intel Core i9-14900K', 'AMD Ryzen 7 9800X3D', 'Intel Core Ultra 7 265K']
const GPUS = ['NVIDIA RTX 4070 Super', 'NVIDIA RTX 4080 Super', 'AMD RX 7800 XT', 'AMD RX 7900 XT', 'NVIDIA RTX 5070', 'NVIDIA RTX 5070 Ti', 'Intel Arc B580']
const OTHER = ['32GB DDR5-6000 CL30 kit', '1TB NVMe Gen4 SSD', '2TB NVMe Gen4 SSD', '850W 80+ Gold PSU', '360mm AIO liquid cooler', 'Tower air cooler (dual fan)', 'B650 ATX motherboard', 'X870E ATX motherboard', 'Z790 ATX motherboard', 'Mesh airflow case with 4 fans']
const SENT = ['I went with this and it has been rock solid for a year.', 'Honestly the fans get loud under load, so check the curves.', 'Coil whine on mine, RMA was painless though.', 'Not worth the premium unless you stream as well.', 'Temps hover around 70C in a small case.', 'The BIOS update fixed my boot loop, so update first.', 'Great for 1440p, a bit tight at 4K.', 'Prices dropped last month so watch the tracker sites.', 'I would wait for the next refresh if you can.', 'Returns were easy and the support chat was fast.']
const INTROS = ['Found this list on a forum, any thoughts?', "A friend sent me this parts dump, what do you make of it?", 'Pasting a thread I was reading, is any of this relevant?', "Here's a price tracker export, does anything stand out?", 'Copied this from a review roundup, thoughts?']
function filler(turn: number) {
  let body = ''
  while (body.length < PASTE_CHARS) {
    const k = R()
    if (k < 0.3) body += `${pick(CPUS)} | ${Math.floor(4 + R() * 12)}C/${Math.floor(8 + R() * 24)}T | boost ${(4.5 + R() * 1.4).toFixed(1)}GHz | TDP ${Math.floor(65 + R() * 120)}W | £${Math.floor(180 + R() * 450)}.99 | rated ${(3.8 + R()).toFixed(1)}/5 (${Math.floor(R() * 4000)} reviews)\n`
    else if (k < 0.6) body += `${pick(GPUS)} | ${pick(['12', '16', '20', '24'])}GB | ${Math.floor(180 + R() * 320)}W | £${Math.floor(300 + R() * 900)}.00 | avg 4K fps ${Math.floor(40 + R() * 90)} | rated ${(3.8 + R()).toFixed(1)}/5\n`
    else if (k < 0.8) body += `${pick(OTHER)} | £${Math.floor(40 + R() * 220)}.00 | in stock: ${pick(['yes', 'yes', 'no', 'low'])} | rated ${(3.8 + R()).toFixed(1)}/5\n`
    else body += `> user${Math.floor(R() * 9000)}: ${pick(SENT)} ${pick(SENT)}\n`
  }
  return `${pick(INTROS)} (turn ${turn}; pasted from the internet, not my own choices)\n\n${body}`
}

const PROBE = `Quick sanity check before we go on.
(1) In one line each, remind me: what my budget and country are, which CPU brand I wanted to avoid, what parts I'm already reusing, and anything I said about noise.
(2) Then, which ONE of these would you pick for me: A) Intel Core i5-14600K £259, B) AMD Ryzen 5 7600X £219, C) Intel Core i7-14700K £339, D) AMD Ryzen 7 7700X £289?`

// ---------- model calls ----------
type Call = { reply: string; inputTokens: number; outputTokens: number; reasoningTokens: number; finishReason: string }
async function chat(messages: ModelMessage[]): Promise<Call> {
  const res = await generateText({ model: google(MAIN), system: SYSTEM, messages, providerOptions: thinking, maxOutputTokens: 8000 })
  spend('main', res.usage)
  return { reply: res.text, inputTokens: res.usage.inputTokens ?? 0, outputTokens: res.usage.outputTokens ?? 0, reasoningTokens: res.usage.outputTokenDetails?.reasoningTokens ?? 0, finishReason: String(res.finishReason) }
}
async function judgePick(reply: string): Promise<string> {
  const res = await generateText({
    model: google(SIDE), providerOptions: thinking,
    output: Output.object({ schema: z.object({ pick: z.enum(['A', 'B', 'C', 'D', 'none']) }) }),
    prompt: `Below is an assistant reply. Which ONE option letter (A, B, C or D) does it say it would pick for the user? Answer "none" if it names none or several.\n\n${reply}`,
  })
  spend('side', res.usage)
  return (res.output as { pick: string }).pick
}
const hasCanary = (r: string) => r.trimStart().startsWith(CANARY)
const stripHistory = (ms: ModelMessage[]): ModelMessage[] => ms.map(m => m.role === 'assistant' ? { ...m, content: stripWhole(CANARY, m.content as string).text } : m)

// ---------- run ----------
const startedAt = new Date().toISOString()
const live: any[] = []
const probes: any[] = []
const factPos: Record<string, number> = {} // prompt tokens when each fact was planted
const history: ModelMessage[] = []
let nextCp = 0
const out = () => ({ startedAt, history, config: { MAIN, SIDE, STOP, CHECKPOINTS, SAMPLES, PASTE_CHARS, CANARY }, spentUsd, factPos, live, probes })
const save = () => { mkdirSync('results', { recursive: true }); writeFileSync(`results/run-${startedAt.replace(/[:.]/g, '-')}.json`, JSON.stringify(out(), null, 1)) }

async function probeAt(cpTarget: number) {
  const variants = [{ name: 'keep', msgs: history }, { name: 'stripped', msgs: stripHistory(history) }]
  const jobs = variants.flatMap(v => Array.from({ length: SAMPLES }, (_, s) => ({ v, s })))
  const results: any[] = []
  // 2 at a time: six parallel 130k-token calls blew Gemini's 2M input tokens/minute limit
  for (let i = 0; i < jobs.length; i += 2) results.push(...await Promise.all(jobs.slice(i, i + 2).map(async ({ v, s }) => {
    const c = await chat([...v.msgs, { role: 'user', content: PROBE }])
    const body = stripWhole(CANARY, c.reply).text
    const facts = Object.fromEntries(FACTS.map(f => [f.key, f.test(body)]))
    return { checkpoint: cpTarget, variant: v.name, sample: s, inputTokens: c.inputTokens, outputTokens: c.outputTokens, canary: hasCanary(c.reply), facts, pickJudged: '', reply: c.reply, finishReason: c.finishReason }
  })))
  for (const r of results) { r.pickJudged = await judgePick(r.reply); probes.push(r) }
  const line = (v: string) => {
    const rs = results.filter(r => r.variant === v)
    const canary = rs.filter(r => r.canary).length
    const facts = FACTS.filter(f => (factPos[f.key] ?? Infinity) < rs[0]!.inputTokens).map(f => `${f.label} ${rs.filter(r => r.facts[f.key]).length}/${rs.length}`).join(', ')
    const picks = rs.filter(r => r.pickJudged === 'B' || r.pickJudged === 'D').length
    return `${v.padEnd(8)} canary ${canary}/${rs.length} | ${facts} | non-Intel pick ${picks}/${rs.length}`
  }
  console.log(`  PROBE @~${Math.round(results[0]!.inputTokens / 1000)}k  ${line('keep')}\n${' '.repeat(22)}${line('stripped')}`)
}

for (let turn = 1; turn <= MAX_TURNS; turn++) {
  const planted = PLANTED[turn]
  const userText = planted ? planted.text : filler(turn)
  history.push({ role: 'user', content: userText })
  const c = await chat(history)
  history.push({ role: 'assistant', content: c.reply })
  if (planted) factPos[planted.key] = c.inputTokens
  const row = { turn, planted: planted?.key ?? null, inputTokens: c.inputTokens, outputTokens: c.outputTokens, reasoningTokens: c.reasoningTokens, finishReason: c.finishReason, canary: hasCanary(c.reply), head: c.reply.slice(0, 70).replace(/\n/g, ' ') }
  live.push(row)
  console.log(`turn ${String(turn).padStart(2)} in=${String(c.inputTokens).padStart(6)} out=${String(c.outputTokens).padStart(4)} canary=${row.canary ? 'yes' : 'NO '} $${spentUsd.toFixed(2)}  ${row.head}`)
  while (nextCp < CHECKPOINTS.length && c.inputTokens >= CHECKPOINTS[nextCp]!) { await probeAt(CHECKPOINTS[nextCp]!); nextCp++; save() }
  if (c.inputTokens >= STOP || nextCp >= CHECKPOINTS.length) break
}
save()
console.log(`\nDone. Spent ~$${spentUsd.toFixed(2)} at intro rates (~$${(spentUsd * 2).toFixed(2)} at the 2027 planning rate).`)
