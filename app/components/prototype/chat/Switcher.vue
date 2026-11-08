<script setup lang="ts">
import { SCENARIOS, setScenario, useProto } from './state'
const props = defineProps<{ variants: { key: string; name: string }[] }>()
const dev = import.meta.dev
const route = useRoute()
const router = useRouter()
const p = useProto()
const idx = computed(() => Math.max(0, props.variants.findIndex(v => v.key === (route.query.variant ?? 'A'))))
const go = (d: number) => {
  const n = props.variants[(idx.value + d + props.variants.length) % props.variants.length]!
  router.replace({ query: { ...route.query, variant: n.key } })
}
const onKey = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement
  if (t.closest('input, textarea, select, [contenteditable]')) return
  if (e.key === 'ArrowLeft') go(-1)
  if (e.key === 'ArrowRight') go(1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
const scenario = computed({ get: () => p.scenario, set: v => setScenario(v) })
</script>

<template>
  <div v-if="dev" class="fixed bottom-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1 rounded-full bg-neutral-900 text-white shadow-xl px-2 py-1 text-sm">
    <button class="size-7 grid place-items-center rounded-full hover:bg-white/15" @click="go(-1)"><UIcon name="i-lucide-chevron-left" /></button>
    <span class="min-w-40 text-center font-medium">{{ variants[idx]!.key }} · {{ variants[idx]!.name }}</span>
    <button class="size-7 grid place-items-center rounded-full hover:bg-white/15" @click="go(1)"><UIcon name="i-lucide-chevron-right" /></button>
    <span class="mx-1 h-4 w-px bg-white/30" />
    <select v-model="scenario" class="bg-transparent text-white outline-none max-w-48 cursor-pointer">
      <option v-for="s in SCENARIOS" :key="s.key" :value="s.key" class="text-black">{{ s.label }}</option>
    </select>
    <span class="mx-1 h-4 w-px bg-white/30" />
    <button class="px-2 h-7 rounded-full hover:bg-white/15" @click="p.isGuest = !p.isGuest">{{ p.isGuest ? 'Guest' : 'Signed in' }}</button>
  </div>
</template>
