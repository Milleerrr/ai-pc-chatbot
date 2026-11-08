// PROTOTYPE (wayfinder ticket #10), throwaway. Compares four ways of keeping the Build Brief up to date.
//
// QUESTION: during an interview turn, should the Brief be updated by
//   A. an in-turn `update_brief` tool inside the interviewer's streamText loop, or
//   B. a separate extraction pass on a cheaper model that returns the same field edits?
// Variants:  A-auto   tool, toolChoice auto
//            A-forced tool forced on step 0 (prepareStep), then text
//            B-post   reply first, then Flash-Lite extraction after the reply
//            B-pre    Flash-Lite extraction first, then the reply sees the fresh Brief
// Judged on: correctness (expected fields), corrections, latency (time to first text), tokens per turn.
//
// Run: pnpm install --ignore-workspace && pnpm run -- [--variants A-auto,B-post] [--scenarios S1,S2,S3] [--runs 1]
import { writeFileSync, mkdirSync } from 'node:fs'
import { createGoogle } from '@ai-sdk/google'
import { generateText, streamText, tool, Output, isStepCount, type ModelMessage } from 'ai'
import { applyEdits, editsSchema, emptyBrief, renderForHuman, renderForPrompt, FIELD_KEYS, FIELDS, type Brief, type Edits, type FieldKey } from './brief.ts'

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
const VARIANTS = arg('variants', 'A-auto,A-forced,B-post,B-pre').split(',')
const SCENARIO_IDS = arg('scenarios', 'S1,S2,S3').split(',')
const RUNS = Number(arg('runs', '1'))

// ---------- scenarios: scripted user turns with the fields we expect afterwards ----------
type Expect = Partial<Record<FieldKey, RegExp>>
type Turn = { user: string; expect: Expect; note?: string; expectNoEdits?: boolean }
const SCENARIOS: Record<string, { title: string; turns: Turn[] }> = {
  S1: {
    title: 'Rich opener, then a correction',
    turns: [
      { user: "Hi, I want a PC for gaming, around £1500. I'm in the UK.", expect: { 'budget.amount': /1[,]?500/, 'budget.currency': /gbp|£|pound/i, 'use.primary': /gam/i, 'context.country': /uk|united kingdom|britain/i } },
      { user: 'Mostly 1440p, ideally 144fps. Cyberpunk and Valorant mainly.', expect: { 'use.performance_target': /1440/, 'use.apps': /cyberpunk/i } },
      { user: 'Actually make that 4K, I just bought a 4K monitor.', expect: { 'use.performance_target': /4k|2160/i }, note: 'correction' },
      { user: "I'd rather avoid Intel after all the stability news. Not fussed about looks at all.", expect: { 'preferences.brands': /intel/i, 'physical.looks': /./ } },
      { user: 'The £1500 is for the tower only, I already have the monitor.', expect: { 'budget.coverage': /tower/i } },
    ],
  },
  S2: {
    title: 'Upgrade, vague answers, a changed number, a changed country',
    turns: [
      { user: "I've got a GTX 1060 and a Ryzen 5 1600. I want to upgrade, keeping my case and PSU.", expect: { 'context.new_or_upgrade': /upgrade/i, 'existing_parts.list': /1060|1600|case|psu/i } },
      { user: 'dunno, maybe 600?', expect: { 'budget.amount': /600/ }, note: 'vague' },
      { user: "Ok let's say 900 then.", expect: { 'budget.amount': /900/ }, note: 'correction' },
      { user: "I'm in Canada.", expect: { 'context.country': /canada/i, 'budget.currency': /cad|canad/i } },
      { user: "It's for video editing in Premiere with 4K footage.", expect: { 'use.primary': /video|edit/i, 'use.apps': /premiere/i } },
    ],
  },
  S3: {
    title: 'Chatter first (no edits wanted), then a dense message',
    turns: [
      { user: 'Hello!', expect: {}, expectNoEdits: true },
      { user: "What's the difference between a CPU and a GPU?", expect: {}, expectNoEdits: true },
      { user: "OK. I want something quiet for office work and some light photo editing. Budget is 800 euros, in Germany, building new.", expect: { 'budget.amount': /800/, 'budget.currency': /eur|€/i, 'context.country': /german/i, 'context.new_or_upgrade': /new/i, 'physical.noise': /quiet|low/i, 'use.primary': /office/i } },
    ],
  },
}

// ---------- prompts ----------
const interviewerPrompt = (brief: Brief) => `You interview a person who wants to build or upgrade a PC, to fill in their Build Brief: needs, constraints and preferences only. Never recommend specific parts.
Be brief and friendly. Ask one or two questions per reply, about fields still unknown (required ones first). Do not re-ask what is already known.

CURRENT BRIEF
${renderForPrompt(brief)}`

const FIELD_HELP = FIELD_KEYS.map((k) => `- ${k}${FIELDS[k].required ? ' (required)' : ''}: ${FIELDS[k].hint}`).join('\n')
const EDIT_RULES = `Status meanings: confirmed = the user said it. assumed = you inferred it and it still needs checking (for example currency from country). unknown = not established. not_needed = the user does not care or it does not apply.
Rules: the latest explicit user statement wins, so a correction is just another edit on the same field. Never set assumed over a confirmed field unless the user said something new. Only list fields that changed this turn. If nothing changed, return no edits.
Fields:
${FIELD_HELP}`

// ---------- per-turn runners ----------
type TurnResult = {
  ttftMs: number | null
  totalMs: number
  extractMs: number | null
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  toolCalls: number
  appliedEdits: number
  rejected: number
  reply: string
  brief: Brief
  error?: string
}

const sumUsage = (...u: Array<{ inputTokens?: number; outputTokens?: number; outputTokenDetails?: { reasoningTokens?: number }; reasoningTokens?: number } | undefined>) => ({
  input: u.reduce((s, x) => s + (x?.inputTokens ?? 0), 0),
  output: u.reduce((s, x) => s + (x?.outputTokens ?? 0), 0),
  reasoning: u.reduce((s, x) => s + (x?.outputTokenDetails?.reasoningTokens ?? x?.reasoningTokens ?? 0), 0),
})

async function extract(brief: Brief, history: ModelMessage[], userMsg: string) {
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant')
  const t = performance.now()
  const res = await generateText({
    model: google(SIDE),
    instructions: `You maintain a structured Build Brief for a PC-building interview. Read the latest exchange and return only the edits it implies.\n${EDIT_RULES}`,
    prompt: `CURRENT BRIEF\n${renderForPrompt(brief)}\n\nLAST ASSISTANT MESSAGE\n${typeof lastAssistant?.content === 'string' ? lastAssistant.content : '(none, this is the first message)'}\n\nLATEST USER MESSAGE\n${userMsg}`,
    output: Output.object({ schema: editsSchema }),
    providerOptions: thinking,
  })
  return { edits: res.output as Edits, ms: performance.now() - t, usage: res.usage }
}

async function runTurn(variant: string, brief: Brief, history: ModelMessage[], userMsg: string): Promise<TurnResult> {
  const start = performance.now()
  let current = brief
  let applied = 0
  let rejected = 0
  let toolCalls = 0
  let extractMs: number | null = null
  let ttft: number | null = null
  let reply = ''
  let usage = sumUsage()
  const messages: ModelMessage[] = [...history, { role: 'user', content: userMsg }]

  try {
    if (variant === 'B-pre') {
      const ex = await extract(brief, history, userMsg)
      extractMs = ex.ms
      const r = applyEdits(current, ex.edits)
      current = r.brief; applied += r.applied.length; rejected += r.rejected.length
      usage = sumUsage(ex.usage)
    }

    const useTool = variant.startsWith('A-')
    const updateBrief = tool({
      description: 'Record what the latest user message established about their Build Brief. Call it whenever the user states or corrects a fact. Pass only changed fields.',
      inputSchema: editsSchema,
      strict: true,
      execute: async (input) => {
        toolCalls++
        const r = applyEdits(current, input)
        current = r.brief; applied += r.applied.length; rejected += r.rejected.length
        return { applied: r.applied.length, rejected: r.rejected }
      },
    })

    const result = streamText({
      model: google(MAIN),
      instructions: interviewerPrompt(current),
      messages,
      ...(useTool && {
        tools: { update_brief: updateBrief },
        stopWhen: isStepCount(3),
        // Re-render the Brief into the prompt before every step so the reply sees fresh state.
        prepareStep: ({ stepNumber }: { stepNumber: number }) => ({
          instructions: interviewerPrompt(current),
          ...(variant === 'A-forced' && { toolChoice: stepNumber === 0 ? ('required' as const) : ('none' as const) }),
        }),
      }),
      providerOptions: thinking,
    })

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        if (ttft === null) ttft = performance.now() - start
        reply += (part as { text?: string }).text ?? ''
      } else if (part.type === 'error') {
        throw (part as { error: unknown }).error
      }
    }
    usage = sumUsage(usage.input || usage.output ? { inputTokens: usage.input, outputTokens: usage.output } : undefined, await result.totalUsage)

    if (variant === 'B-post') {
      const ex = await extract(brief, history, userMsg)
      extractMs = ex.ms
      const r = applyEdits(current, ex.edits)
      current = r.brief; applied += r.applied.length; rejected += r.rejected.length
      usage = sumUsage({ inputTokens: usage.input, outputTokens: usage.output, outputTokenDetails: { reasoningTokens: usage.reasoning } }, ex.usage)
    }
  } catch (e) {
    return { ttftMs: ttft, totalMs: performance.now() - start, extractMs, inputTokens: usage.input, outputTokens: usage.output, reasoningTokens: usage.reasoning, toolCalls, appliedEdits: applied, rejected, reply, brief: current, error: String((e as Error)?.message ?? e).slice(0, 300) }
  }

  return { ttftMs: ttft, totalMs: performance.now() - start, extractMs, inputTokens: usage.input, outputTokens: usage.output, reasoningTokens: usage.reasoning, toolCalls, appliedEdits: applied, rejected, reply, brief: current }
}

// ---------- driver ----------
type Row = { variant: string; scenario: string; run: number; turn: number; user: string; note?: string; pass: number; total: number; missed: string[]; falseEdit: boolean; r: TurnResult }
const rows: Row[] = []

for (const variant of VARIANTS) {
  for (const sid of SCENARIO_IDS) {
    for (let run = 1; run <= RUNS; run++) {
      const sc = SCENARIOS[sid]!
      console.log(`\n=== ${variant} · ${sid} ${sc.title} · run ${run} ===`)
      let brief = emptyBrief()
      const history: ModelMessage[] = []
      for (const [i, turn] of sc.turns.entries()) {
        const r = await runTurn(variant, brief, history, turn.user)
        const keys = Object.keys(turn.expect) as FieldKey[]
        const missed = keys.filter((k) => !r.brief.fields[k].value || !turn.expect[k]!.test(r.brief.fields[k].value!))
        const falseEdit = !!turn.expectNoEdits && r.appliedEdits > 0
        rows.push({ variant, scenario: sid, run, turn: i + 1, user: turn.user, note: turn.note, pass: keys.length - missed.length, total: keys.length, missed, falseEdit, r })
        console.log(`\n[turn ${i + 1}${turn.note ? ' ' + turn.note : ''}] USER: ${turn.user}`)
        console.log(`  ASSISTANT: ${r.reply.replace(/\n/g, ' ').slice(0, 220)}${r.error ? `\n  ERROR: ${r.error}` : ''}`)
        console.log(`  ttft ${r.ttftMs?.toFixed(0) ?? '-'}ms · total ${r.totalMs.toFixed(0)}ms${r.extractMs ? ` (extract ${r.extractMs.toFixed(0)}ms)` : ''} · tokens in ${r.inputTokens} out ${r.outputTokens} (thinking ${r.reasoningTokens}) · tool calls ${r.toolCalls} · edits ${r.appliedEdits} rejected ${r.rejected}`)
        console.log(`  expected ${keys.length - missed.length}/${keys.length}${missed.length ? ' MISSED: ' + missed.join(', ') : ''}${falseEdit ? ' FALSE EDIT on chatter' : ''}`)
        console.log(renderForHuman(r.brief))
        brief = r.brief
        history.push({ role: 'user', content: turn.user }, { role: 'assistant', content: r.reply })
      }
    }
  }
}

// ---------- summary ----------
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : NaN)
console.log('\n=== SUMMARY ===')
console.log('variant   | fields right | corrections right | false edits | median ttft ms | median total ms | avg in tok | avg out tok | errors')
for (const v of VARIANTS) {
  const rs = rows.filter((x) => x.variant === v)
  const pass = rs.reduce((s, x) => s + x.pass, 0)
  const total = rs.reduce((s, x) => s + x.total, 0)
  const corr = rs.filter((x) => x.note === 'correction')
  console.log(
    [
      v.padEnd(9),
      `${pass}/${total}`.padEnd(12),
      `${corr.filter((x) => x.missed.length === 0).length}/${corr.length}`.padEnd(17),
      String(rs.filter((x) => x.falseEdit).length).padEnd(11),
      med(rs.map((x) => x.r.ttftMs ?? NaN).filter((n) => !Number.isNaN(n))).toFixed(0).padEnd(14),
      med(rs.map((x) => x.r.totalMs)).toFixed(0).padEnd(15),
      avg(rs.map((x) => x.r.inputTokens)).toFixed(0).padEnd(10),
      avg(rs.map((x) => x.r.outputTokens)).toFixed(0).padEnd(11),
      String(rs.filter((x) => x.r.error).length),
    ].join(' | '),
  )
}
const tc = rows.filter((x) => x.variant === 'A-auto')
if (tc.length) console.log(`\nA-auto skipped the tool on ${tc.filter((x) => x.total > 0 && x.r.toolCalls === 0).length} of ${tc.filter((x) => x.total > 0).length} turns that should have produced edits.`)

mkdirSync('results', { recursive: true })
const file = `results/run-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
writeFileSync(file, JSON.stringify({ MAIN, SIDE, VARIANTS, SCENARIO_IDS, RUNS, rows }, null, 2))
console.log(`\nSaved ${file}`)
