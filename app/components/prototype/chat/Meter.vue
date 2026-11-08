<script setup lang="ts">
import { CONTEXT_BUDGET, WARN_AT, current, usagePct } from './state'
const props = defineProps<{ kind: 'bar' | 'ring' | 'segments'; label?: boolean }>()
const pct = computed(() => Math.min(1, usagePct.value))
const color = computed(() => (pct.value >= 1 ? 'error' : pct.value >= WARN_AT ? 'warning' : 'primary'))
const k = (n: number) => `${Math.round(n / 1000)}k`
const text = computed(() => `${k(current.value?.tokens ?? 0)} / ${k(CONTEXT_BUDGET)}`)
const ring = computed(() => { const r = 14, c = 2 * Math.PI * r; return { r, c, off: c * (1 - pct.value) } })
const segs = computed(() => Array.from({ length: 20 }, (_, i) => i / 20 < pct.value))
const cls = { primary: 'text-primary bg-primary', warning: 'text-warning bg-warning', error: 'text-error bg-error' }
</script>

<template>
  <UTooltip :text="`Context: ${text} tokens (${Math.round(pct * 100)}%). Warning at 80%, blocked at 100%.`">
    <div v-if="kind === 'bar'" class="flex items-center gap-2 w-full">
      <div class="relative flex-1">
        <UProgress :model-value="Math.round(pct * 100)" :color="color" size="xs" />
        <span class="absolute top-[-2px] h-2 w-px bg-muted" style="left: 80%" />
      </div>
      <span v-if="label !== false" class="text-xs tabular-nums text-muted whitespace-nowrap">{{ text }}</span>
    </div>

    <div v-else-if="kind === 'ring'" class="relative size-9 shrink-0">
      <svg viewBox="0 0 36 36" class="size-9 -rotate-90">
        <circle cx="18" cy="18" :r="ring.r" fill="none" stroke="currentColor" class="text-accented" stroke-width="3" />
        <circle cx="18" cy="18" :r="ring.r" fill="none" stroke="currentColor" :class="cls[color].split(' ')[0]" stroke-width="3" stroke-linecap="round" :stroke-dasharray="ring.c" :stroke-dashoffset="ring.off" />
      </svg>
      <span class="absolute inset-0 grid place-items-center text-[10px] font-medium tabular-nums">{{ Math.round(pct * 100) }}</span>
    </div>

    <div v-else class="flex items-center gap-2">
      <div class="flex gap-[2px]">
        <span v-for="(on, i) in segs" :key="i" class="h-4 w-1.5 rounded-sm" :class="[on ? cls[color].split(' ')[1] : 'bg-accented', i === 15 ? 'ml-1' : '']" />
      </div>
      <span v-if="label !== false" class="text-xs tabular-nums text-muted whitespace-nowrap">{{ text }}</span>
    </div>
  </UTooltip>
</template>
