// PROTOTYPE, throwaway. Answers one question: how should the Chat v1 screen
// look and behave? Everything here is in-memory mock state, no tRPC, no DB.
// Variants A/B/C all read this one store so they can be compared on identical data.
import { reactive, computed } from 'vue'

export type Status = 'confirmed' | 'assumed' | 'unknown' | 'not_needed'
export interface BField { key: string; label: string; value: string; status: Status; required?: boolean }
export interface BSection { id: string; title: string; fields: BField[] }
export interface Brief {
  headline: string
  status: 'in_progress' | 'ready'
  sections: BSection[]
  openQuestions: string[]
}
export interface PMsg {
  id: string
  role: 'user' | 'assistant'
  parts: { type: 'text'; text: string }[]
  receipt?: string[]
}
export interface PChat {
  id: string
  title: string
  buildId: string
  updated: string
  archived: boolean
  titleManual: boolean
  tokens: number
  continuedFrom?: string
  continuedTo?: string
  messages: PMsg[]
}

export const CONTEXT_BUDGET = 128_000
export const WARN_AT = 0.8

export type Scenario =
  | 'chatting' | 'new-build' | 'streaming' | 'warning' | 'locked' | 'continuation'
  | 'archived' | 'allowance-low' | 'capped-5h' | 'capped-week' | 'failed' | 'ready'

export const SCENARIOS: { key: Scenario; label: string }[] = [
  { key: 'chatting', label: 'Mid-interview' },
  { key: 'new-build', label: 'New Build (Setup Form)' },
  { key: 'streaming', label: 'Reply streaming now' },
  { key: 'warning', label: 'Context 84% warning' },
  { key: 'locked', label: 'Context limit locked' },
  { key: 'continuation', label: 'Continuation (new Chat)' },
  { key: 'archived', label: 'Archived Chat (read-only)' },
  { key: 'allowance-low', label: 'Allowance: 3 left' },
  { key: 'capped-5h', label: 'Allowance: 5-hour cap' },
  { key: 'capped-week', label: 'Allowance: weekly cap' },
  { key: 'failed', label: 'Reply failed (Retry)' },
  { key: 'ready', label: 'Brief Ready' },
]

let uid = 0
const id = (p: string) => `${p}${++uid}`
const m = (role: PMsg['role'], text: string, receipt?: string[]): PMsg => ({ id: id('m'), role, parts: [{ type: 'text', text }], receipt })

const f = (key: string, label: string, value: string, status: Status, required = false): BField => ({ key, label, value, status, required })

function midBrief(): Brief {
  return {
    headline: 'New 1440p gaming PC, about $1,500, tower only, quiet preferred',
    status: 'in_progress',
    sections: [
      { id: 'budget', title: 'Budget', fields: [
        f('amount', 'Amount', '1,500', 'confirmed', true),
        f('currency', 'Currency', 'USD', 'assumed', true),
        f('coverage', 'Coverage', 'Tower only', 'confirmed', true),
        f('flex', 'Flexibility', 'Up to about +10%', 'assumed'),
      ] },
      { id: 'use', title: 'Use', fields: [
        f('primary', 'Primary use', 'Gaming', 'confirmed', true),
        f('apps', 'Games / apps', 'Cyberpunk 2077, Baldur\'s Gate 3', 'confirmed'),
        f('target', 'Performance target', '1440p, 60+ fps on high', 'assumed', true),
        f('secondary', 'Secondary uses', 'Some streaming', 'confirmed'),
      ] },
      { id: 'physical', title: 'Physical', fields: [
        f('form', 'Form factor', '', 'unknown'),
        f('noise', 'Noise', 'Quiet preferred', 'assumed'),
        f('looks', 'Looks', '', 'unknown'),
      ] },
      { id: 'existing', title: 'Existing Parts', fields: [
        f('parts', 'Reusing', 'Not an upgrade', 'not_needed'),
      ] },
      { id: 'prefs', title: 'Preferences', fields: [
        f('brands', 'Brands', '', 'unknown'),
        f('deal', 'Deal-breakers', '', 'unknown'),
      ] },
      { id: 'context', title: 'Context', fields: [
        f('country', 'Country', 'United States', 'confirmed', true),
        f('kind', 'New or upgrade', 'New build', 'confirmed', true),
        f('timeframe', 'Timeframe', 'Within a month', 'assumed'),
        f('horizon', 'Upgrade horizon', '', 'unknown'),
      ] },
    ],
    openQuestions: ['You asked for quiet and for high-refresh gaming. Which matters more if they conflict?'],
  }
}

function emptyBrief(): Brief {
  const b = midBrief()
  b.headline = 'New Build, nothing established yet'
  for (const s of b.sections) for (const x of s.fields) { x.value = ''; x.status = 'unknown' }
  b.openQuestions = []
  return b
}

function readyBrief(): Brief {
  const b = midBrief()
  b.status = 'ready'
  for (const s of b.sections) for (const x of s.fields) {
    if (x.status === 'assumed') x.status = 'confirmed'
    if (x.status === 'unknown') { x.status = 'confirmed'; x.value = x.key === 'form' ? 'Mid tower' : x.key === 'looks' ? 'No RGB' : x.key === 'brands' ? 'No preference' : x.key === 'deal' ? 'Loud fans' : 'Upgrade GPU in 3 years' }
  }
  b.openQuestions = []
  return b
}

const GAMING_MESSAGES = (): PMsg[] => [
  m('assistant', 'Thanks, I have your setup. **New build, United States, about $1,500, tower only.**\n\nWhat will you mainly use this PC for?'),
  m('user', 'Mostly gaming. Cyberpunk and Baldur\'s Gate 3 right now, and I stream a bit on weekends.', ['Primary use → Gaming', 'Games / apps → Cyberpunk 2077, Baldur\'s Gate 3', 'Secondary uses → Some streaming']),
  m('assistant', 'Nice. Those two are demanding, so I\'ll plan around **1440p at 60+ fps on high settings** unless you want something different.\n\nDo you mind fan noise while you play?'),
  m('user', 'I\'d rather it be quiet, my desk is next to my bed.', ['Noise → Quiet preferred']),
  m('assistant', 'Quiet it is. One thing to check: quiet and very high refresh rates can pull in opposite directions.\n\nIf they conflict, which matters more to you?'),
]

function smallChat(title: string, buildId: string, updated: string, archived = false): PChat {
  return {
    id: id('c'), title, buildId, updated, archived, titleManual: false, tokens: 9_000,
    messages: [m('assistant', 'What will you mainly use this PC for?'), m('user', 'Something for ' + title.toLowerCase() + '.')],
  }
}

export const REPLIES: { text: string; edits: { section: string; key: string; value: string; status: Status }[] }[] = [
  { text: 'Understood. I\'ll **favour quiet** and aim for a card that stays cool under load.\n\nThree quick things to settle:\n- Mid tower or something smaller?\n- Any brands you love or avoid?\n- Do you plan to upgrade the GPU later?\n\nStart with the case size.', edits: [{ section: 'physical', key: 'noise', value: 'Quiet, wins over refresh rate', status: 'confirmed' }] },
  { text: 'A mid tower gives the best airflow for the money, so I\'ll note that. Any brands you want me to avoid?', edits: [{ section: 'physical', key: 'form', value: 'Mid tower', status: 'confirmed' }] },
  { text: 'No problem, I\'ll stay brand-neutral. That covers most of what I need.', edits: [{ section: 'prefs', key: 'brands', value: 'No preference', status: 'confirmed' }] },
]

interface Store {
  scenario: Scenario
  isGuest: boolean
  chats: PChat[]
  briefs: Record<string, Brief>
  currentId: string | null
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  briefUpdating: boolean
  changed: string[]
  used5h: number
  usedWeek: number
  continuing: boolean
  renaming: { id: string; value: string } | null
  deleting: string | null
  replyIdx: number
  sidebarTab: 'chats' | 'archived'
  summaryOffered: boolean
}

const proto = reactive<Store>({
  scenario: 'chatting', isGuest: false, chats: [], briefs: {}, currentId: null, status: 'ready',
  briefUpdating: false, changed: [], used5h: 6, usedWeek: 31, continuing: false, renaming: null, deleting: null,
  replyIdx: 0, sidebarTab: 'chats', summaryOffered: false,
})

let timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
function clearTimers() { timers.forEach(clearTimeout); timers = [] }

export function setScenario(s: Scenario) {
  clearTimers()
  uid = 0
  proto.scenario = s
  proto.status = 'ready'
  proto.briefUpdating = false
  proto.changed = []
  proto.continuing = false
  proto.renaming = null
  proto.deleting = null
  proto.replyIdx = 0
  proto.summaryOffered = false
  proto.sidebarTab = s === 'archived' ? 'archived' : 'chats'
  proto.used5h = s === 'allowance-low' ? 17 : s === 'capped-5h' ? 20 : 6
  proto.usedWeek = s === 'capped-week' ? 40 : 21
  const main: PChat = { id: 'c-main', title: 'Gaming PC under $1,500', buildId: 'b1', updated: 'Just now', archived: false, titleManual: false, tokens: 21_000, messages: GAMING_MESSAGES() }
  const others = [smallChat('Upgrade my GTX 1060', 'b2', 'Yesterday'), smallChat('Quiet home server', 'b3', '3 days ago'), smallChat('Video editing rig', 'b4', 'Last week', true), smallChat('Old office PC', 'b5', '2 weeks ago', true)]
  proto.briefs = { b1: midBrief(), b2: midBrief(), b3: midBrief(), b4: readyBrief(), b5: readyBrief() }
  proto.briefs.b2!.headline = 'Upgrade: replace a GTX 1060, keep the rest'
  proto.briefs.b3!.headline = 'Quiet always-on home server, about $600'
  proto.briefs.b4!.headline = 'Video editing, 4K timeline, about $2,800'
  proto.briefs.b5!.headline = 'Office PC refresh, about $500'
  proto.chats = [main, ...others]
  proto.currentId = main.id

  if (s === 'new-build') proto.currentId = null
  if (s === 'warning') main.tokens = 108_000
  if (s === 'locked') main.tokens = CONTEXT_BUDGET
  if (s === 'continuation') {
    main.tokens = CONTEXT_BUDGET
    const cont = continuationOf(main)
    main.continuedTo = cont.id
    proto.chats.unshift(cont)
    proto.currentId = cont.id
  }
  if (s === 'archived') proto.currentId = proto.chats.find(c => c.archived)!.id
  if (s === 'failed') { main.messages.push(m('user', 'Quiet, definitely. I can live with 90 fps.')); proto.status = 'error' }
  if (s === 'ready') {
    proto.briefs.b1 = readyBrief(); proto.briefs.b1.status = 'in_progress'; proto.summaryOffered = true
    main.messages.push(m('assistant', 'I think I have everything. Here is the summary:\n\n- **New build**, United States, **USD 1,500**, tower only\n- **Gaming** at 1440p, 60+ fps on high, some streaming\n- **Quiet** wins over refresh rate, mid tower, no RGB\n- No brand preferences, no loud fans\n\nDoes this look right?'))
  }
  if (s === 'streaming') later(() => send('Quiet, definitely. I can live with 90 fps.', true), 300)
}

function continuationOf(from: PChat): PChat {
  return {
    id: id('c'), title: from.title + ' (continued)', buildId: from.buildId, updated: 'Just now', archived: false,
    titleManual: false, tokens: 6_500, continuedFrom: from.id,
    messages: [m('assistant', 'Picking up where we left off: a **quiet 1440p gaming PC around $1,500**, tower only.\n\nYou were deciding whether quiet or high refresh matters more. Which wins?')],
  }
}

export const current = computed(() => proto.chats.find(c => c.id === proto.currentId) ?? null)
export const brief = computed(() => (current.value ? proto.briefs[current.value.buildId] ?? null : null))
export const usagePct = computed(() => (current.value ? current.value.tokens / CONTEXT_BUDGET : 0))
export const locked = computed(() => !!current.value && (usagePct.value >= 1 || !!current.value.continuedTo))
export const warning = computed(() => usagePct.value >= WARN_AT && !locked.value)
export const archivedView = computed(() => !!current.value?.archived)

const caps = computed(() => (proto.isGuest ? { h5: 20, wk: 40 } : { h5: 40, wk: 200 }))
export const allowance = computed(() => {
  const left5 = caps.value.h5 - Math.min(proto.used5h, caps.value.h5 + 99)
  const leftWk = caps.value.wk - proto.usedWeek
  const capped = left5 <= 0 ? ('5h' as const) : leftWk <= 0 ? ('week' as const) : null
  const left = Math.min(left5, leftWk)
  return { left5, leftWk, left, capped, low: !capped && left <= 5 }
})
export const composerDisabled = computed(() => !current.value || archivedView.value || locked.value || !!allowance.value.capped)

export const requiredProgress = computed(() => {
  const req = brief.value?.sections.flatMap(s => s.fields).filter(x => x.required) ?? []
  const done = req.filter(x => x.status === 'confirmed' || x.status === 'not_needed').length
  return { done, total: req.length }
})

export function field(sectionId: string, key: string) { return brief.value?.sections.find(s => s.id === sectionId)?.fields.find(x => x.key === key) }
export function isChanged(sectionId: string, key: string) { return proto.changed.includes(`${sectionId}.${key}`) }

export function send(text: string, alreadyAdded = false) {
  const c = current.value
  if (!c || proto.status === 'streaming' || proto.status === 'submitted') return
  if (!alreadyAdded) { c.messages.push(m('user', text)); proto.used5h++; proto.usedWeek++ }
  proto.status = 'submitted'
  const reply = REPLIES[Math.min(proto.replyIdx, REPLIES.length - 1)]!
  const msg = m('assistant', '')
  later(() => {
    c.messages.push(msg)
    proto.status = 'streaming'
    const words = reply.text.split(/(?<= )/)
    let i = 0
    const tick = () => {
      if (proto.status !== 'streaming') return
      if (i >= words.length) return finish()
      msg.parts[0]!.text += words[i++]
      later(tick, 45)
    }
    const finish = () => {
      proto.status = 'ready'
      c.tokens += 2_400
      proto.replyIdx++
      if (!c.titleManual && c.title === 'New chat') c.title = 'Gaming PC under $1,500'
      proto.briefUpdating = true
      later(() => {
        proto.briefUpdating = false
        const b = proto.briefs[c.buildId]
        const receipts: string[] = []
        proto.changed = []
        for (const e of reply.edits) {
          const fl = b?.sections.find(s => s.id === e.section)?.fields.find(x => x.key === e.key)
          if (!fl) continue
          fl.value = e.value; fl.status = e.status
          proto.changed.push(`${e.section}.${e.key}`)
          receipts.push(`${fl.label} → ${e.value}`)
        }
        msg.receipt = receipts
        if (reply.edits.length) later(() => { proto.changed = [] }, 6000)
      }, 1400)
    }
    tick()
  }, 700)
}

/** Stop keeps the partial reply, like the real Stop will. */
export function stop() { if (proto.status === 'streaming' || proto.status === 'submitted') proto.status = 'ready' }

export function retry() {
  const c = current.value
  if (!c) return
  const last = c.messages[c.messages.length - 1]
  if (last?.role === 'user') send(last.parts[0]!.text, true)
}

export function startContinuation() {
  const c = current.value
  if (!c || proto.continuing) return
  proto.continuing = true
  later(() => {
    const cont = continuationOf(c)
    c.continuedTo = cont.id
    proto.chats.unshift(cont)
    proto.currentId = cont.id
    proto.continuing = false
  }, 1400)
}

export function select(chatId: string) { clearTimers(); proto.status = 'ready'; proto.briefUpdating = false; proto.currentId = chatId }
export function newBuild() { clearTimers(); proto.status = 'ready'; proto.currentId = null }
export function toggleArchive(chatId: string) {
  const c = proto.chats.find(x => x.id === chatId); if (!c) return
  c.archived = !c.archived
  if (c.archived && proto.currentId === chatId) proto.sidebarTab = 'archived'
}
export function confirmDelete() {
  const idx = proto.chats.findIndex(x => x.id === proto.deleting)
  if (idx >= 0) {
    const wasCurrent = proto.chats[idx]!.id === proto.currentId
    proto.chats.splice(idx, 1)
    if (wasCurrent) proto.currentId = proto.chats.find(c => !c.archived)?.id ?? null
  }
  proto.deleting = null
}
export function commitRename() {
  const r = proto.renaming; if (!r) return
  const c = proto.chats.find(x => x.id === r.id)
  if (c && r.value.trim()) { c.title = r.value.trim(); c.titleManual = true }
  proto.renaming = null
}
export function looksRight() {
  const b = brief.value; if (!b) return
  b.status = 'ready'
  proto.summaryOffered = false
  for (const s of b.sections) for (const x of s.fields) if (x.status === 'assumed') x.status = 'confirmed'
}

export interface SetupAnswers { kind: string; use: string; country: string; currency: string; budget: string; coverage: string; prefs: string }
/** Submit creates Build + Chat + templated opener in one step, no model call. */
export function submitSetup(a: SetupAnswers | null) {
  const buildId = id('b')
  const b = emptyBrief()
  let opener = 'What will you mainly use this PC for?'
  if (a) {
    const set = (sec: string, key: string, v: string) => {
      const fl = b.sections.find(s => s.id === sec)!.fields.find(x => x.key === key)!
      if (v && v !== 'Not sure') { fl.value = v; fl.status = 'confirmed' }
    }
    set('context', 'kind', a.kind); set('context', 'country', a.country); set('budget', 'currency', a.currency)
    set('budget', 'amount', a.budget); set('budget', 'coverage', a.coverage); set('use', 'primary', a.use)
    if (a.kind === 'New build') set('existing', 'parts', 'Not an upgrade')
    if (a.kind === 'New build') b.sections.find(s => s.id === 'existing')!.fields[0]!.status = 'not_needed'
    b.headline = [a.kind, a.use !== 'Not sure' ? a.use.toLowerCase() : '', a.budget ? `about ${a.currency} ${a.budget}` : ''].filter(Boolean).join(', ')
    opener = `Thanks, I have your setup: **${[a.kind, a.country, a.budget && `${a.currency} ${a.budget}`].filter(Boolean).join(', ')}**.\n\nTell me a bit more about how you'll use it.`
  }
  proto.briefs[buildId] = b
  const chat: PChat = { id: id('c'), title: 'New chat', buildId, updated: 'Just now', archived: false, titleManual: false, tokens: 3_200, messages: [m('assistant', opener)] }
  proto.chats.unshift(chat)
  proto.currentId = chat.id
  proto.replyIdx = 0
}

export function useProto() { return proto }
export function menuItems(chat: PChat) {
  return [
    [{ label: 'Rename', icon: 'i-lucide-pencil', onSelect: () => { proto.renaming = { id: chat.id, value: chat.title } } }],
    [
      { label: chat.archived ? 'Restore' : 'Archive', icon: chat.archived ? 'i-lucide-archive-restore' : 'i-lucide-archive', onSelect: () => toggleArchive(chat.id) },
      { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => { proto.deleting = chat.id } },
    ],
  ]
}

export function renderMd(text: string) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const lines = esc.split('\n').map(l => (l.startsWith('- ') ? `<li>${l.slice(2)}</li>` : l === '' ? '<br>' : `<p>${l}</p>`))
  return lines.join('').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(<li>.*?<\/li>)+/g, s => `<ul class="list-disc pl-5">${s}</ul>`)
}

setScenario('chatting')
