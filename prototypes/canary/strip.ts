// PROTOTYPE (wayfinder ticket #15), throwaway. Server-side canary stripper for a text stream.
// Buffers only while the output could still be the start of the canary, so the user sees no delay
// once the first characters rule it in or out. `missing` is the warning signal for the Message.
export function createCanaryStripper(canary: string) {
  let state: 'detecting' | 'trimming' | 'done' = 'detecting'
  let buf = ''
  let missing = false
  return {
    get missing() { return missing },
    push(delta: string): string {
      if (state === 'done') return delta
      if (state === 'trimming') { // drop the whitespace that separated the canary from the reply, even across chunks
        const rest = delta.replace(/^\s+/, '')
        if (rest) state = 'done'
        return rest
      }
      buf += delta
      const t = buf.trimStart()
      if (t.length < canary.length && canary.startsWith(t)) return '' // still could be the canary
      state = 'done'
      if (t.startsWith(canary)) { const out = t.slice(canary.length).replace(/^\s+/, ''); buf = ''; if (!out) state = 'trimming'; return out }
      missing = true
      const out = buf; buf = ''; return out
    },
    flush(): string {
      if (state !== 'detecting') return ''
      state = 'done'; missing = true // stream ended before the canary completed
      const out = buf; buf = ''; return out
    },
  }
}

export function stripWhole(canary: string, text: string) {
  const s = createCanaryStripper(canary)
  const out = s.push(text) + s.flush()
  return { text: out, missing: s.missing }
}

// self-check: any chunking of the stream gives the same visible text
if (process.argv[1]?.endsWith('strip.ts')) {
  const C = '[[pcb-7q]]'
  const cases = [`${C} Hello there\nSecond line`, `Hello without it`, `[[pcb-7`, `  ${C}\nNo space`, `[[pcb-7x]] near miss`, '']
  for (const text of cases) {
    const want = stripWhole(C, text)
    for (let trial = 0; trial < 200; trial++) {
      const s = createCanaryStripper(C)
      let out = ''
      for (let i = 0; i < text.length;) { const n = 1 + Math.floor(Math.random() * 4); out += s.push(text.slice(i, i + n)); i += n }
      out += s.flush()
      if (out !== want.text || s.missing !== want.missing) throw new Error(`chunking changed output for ${JSON.stringify(text)}: ${JSON.stringify(out)} vs ${JSON.stringify(want.text)}`)
    }
    console.log(JSON.stringify(text).slice(0, 40).padEnd(42), '->', JSON.stringify(want.text).slice(0, 40), want.missing ? '(canary missing)' : '(canary stripped)')
  }
}
