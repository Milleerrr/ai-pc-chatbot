// PROTOTYPE (wayfinder ticket #10), throwaway. Pure Brief logic, no I/O: liftable if the decision lands.
import { z } from 'zod'

export const STATUSES = ['confirmed', 'assumed', 'unknown', 'not_needed'] as const
export type Status = (typeof STATUSES)[number]

// Flat, fixed field list from ticket #7. `required` = must be Confirmed before the Brief can be Ready.
export const FIELDS = {
  'budget.amount': { required: true, hint: 'number only, e.g. 1500' },
  'budget.currency': { required: true, hint: 'ISO code, e.g. GBP. Starts Assumed from the country' },
  'budget.coverage': { required: true, hint: 'tower only, or incl. monitor / peripherals / OS' },
  'budget.flexibility': { required: false, hint: 'how firm the budget is' },
  'use.primary': { required: true, hint: 'one primary use, e.g. gaming, video editing, office' },
  'use.apps': { required: false, hint: 'specific apps or games' },
  'use.performance_target': { required: true, hint: 'e.g. 1440p 144fps. May be not_needed for light uses' },
  'use.secondary': { required: false, hint: 'free text' },
  'physical.form_factor': { required: false, hint: 'size limits, form factor' },
  'physical.noise': { required: false, hint: 'noise tolerance' },
  'physical.looks': { required: false, hint: 'aesthetics' },
  'existing_parts.list': { required: false, hint: 'parts/peripherals being reused. Required for upgrades' },
  'preferences.brands': { required: false, hint: 'brands liked or avoided' },
  'preferences.deal_breakers': { required: false, hint: 'hard no-gos' },
  'context.country': { required: true, hint: 'country of purchase' },
  'context.new_or_upgrade': { required: true, hint: 'new | upgrade' },
  'context.timeframe': { required: false, hint: 'when they want to buy' },
  'context.upgrade_horizon': { required: false, hint: 'how long it should last' },
} as const
export type FieldKey = keyof typeof FIELDS
export const FIELD_KEYS = Object.keys(FIELDS) as [FieldKey, ...FieldKey[]]

export type FieldState = { value: string | null; status: Status }
export type Brief = {
  headline: string
  fields: Record<FieldKey, FieldState>
  openQuestions: string[]
}

export function emptyBrief(): Brief {
  return {
    headline: '',
    fields: Object.fromEntries(FIELD_KEYS.map((k) => [k, { value: null, status: 'unknown' as Status }])) as Brief['fields'],
    openQuestions: [],
  }
}

// One edit shape for both approaches. `field` is an enum so the schema can constrain it.
export const editSchema = z.object({
  field: z.enum(FIELD_KEYS),
  value: z.string().describe('The value in plain words. Empty string when status is unknown or not_needed.'),
  status: z.enum(STATUSES),
})
export const editsSchema = z.object({
  edits: z.array(editSchema).describe('Only fields that changed this turn. Empty if nothing changed.'),
  headline: z.string().optional().describe('One line summarising the Build so far. Omit if unchanged.'),
  addOpenQuestions: z.array(z.string()).optional().describe('Contradictions or things still to ask.'),
})
export type Edits = z.infer<typeof editsSchema>

export type Rejection = { field: string; reason: string }
export type ApplyResult = { brief: Brief; applied: z.infer<typeof editSchema>[]; rejected: Rejection[]; changed: boolean }

// Rules from ticket #7: latest explicit statement wins; an Assumed value never overwrites a Confirmed one.
// A real conflict (assumed over confirmed with a different value) is rejected here and surfaced as an Open Question.
export function applyEdits(brief: Brief, edits: Edits): ApplyResult {
  const next: Brief = structuredClone(brief)
  const applied: ApplyResult['applied'] = []
  const rejected: Rejection[] = []

  for (const e of edits.edits) {
    const cur = next.fields[e.field]
    if (!cur) {
      rejected.push({ field: e.field, reason: 'unknown field' })
      continue
    }
    if (e.status === 'assumed' && cur.status === 'confirmed') {
      rejected.push({ field: e.field, reason: 'assumed cannot overwrite confirmed' })
      continue
    }
    if (cur.value === (e.value || null) && cur.status === e.status) continue // no-op
    next.fields[e.field] = { value: e.value === '' ? null : e.value, status: e.status }
    applied.push(e)
  }
  if (edits.headline && edits.headline !== next.headline) next.headline = edits.headline
  for (const q of edits.addOpenQuestions ?? []) if (!next.openQuestions.includes(q)) next.openQuestions.push(q)

  const changed = applied.length > 0 || next.headline !== brief.headline || next.openQuestions.length !== brief.openQuestions.length
  return { brief: next, applied, rejected, changed }
}

export function unknownFields(brief: Brief): FieldKey[] {
  return FIELD_KEYS.filter((k) => brief.fields[k].status === 'unknown')
}

// Rendered into the interviewer prompt every turn. The model never has to remember the Brief.
export function renderForPrompt(brief: Brief): string {
  const lines = FIELD_KEYS.map((k) => {
    const f = brief.fields[k]
    return `- ${k} [${f.status}${FIELDS[k].required ? ', required' : ''}]: ${f.value ?? '(none)'}`
  })
  const unknown = unknownFields(brief)
  return [
    `Headline: ${brief.headline || '(none yet)'}`,
    ...lines,
    `Open questions: ${brief.openQuestions.length ? brief.openQuestions.join(' | ') : '(none)'}`,
    `Still unknown (ask about these, required ones first, one or two at a time): ${unknown.join(', ') || '(none)'}`,
    `Already known: do not re-ask confirmed fields.`,
  ].join('\n')
}

export function renderForHuman(brief: Brief): string {
  const icon: Record<Status, string> = { confirmed: 'C', assumed: 'A', unknown: '.', not_needed: 'N' }
  return FIELD_KEYS.filter((k) => brief.fields[k].status !== 'unknown')
    .map((k) => `  [${icon[brief.fields[k].status]}] ${k} = ${brief.fields[k].value ?? ''}`)
    .join('\n') || '  (empty)'
}
