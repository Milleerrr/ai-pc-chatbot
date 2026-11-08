<script setup lang="ts">
// Header badge that opens the Brief drawer. Plays a "power-up" when the assistant
// changes the Brief: ring burst, sparkles, glow, and a floating "+N".
import { useProto, brief, requiredProgress } from './state'
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const p = useProto()
const burst = ref(0)
const gain = ref(0)
const unseen = ref(0)
const ready = ref(false)
watch(() => p.changed.length, (n, o) => {
  if (n > 0 && o === 0) { gain.value = n; burst.value++; if (!props.open) unseen.value += n }
})
watch(() => brief.value?.status, (s, o) => {
  if (s === 'ready' && o === 'in_progress') { ready.value = true; burst.value++; setTimeout(() => (ready.value = false), 2500) }
})
watch(() => props.open, v => { if (v) unseen.value = 0 })
watch(() => p.scenario, () => { unseen.value = 0 })
const angles = Array.from({ length: 10 }, (_, i) => i * 36)
</script>

<template>
  <div class="relative">
    <button
      :key="`btn-${burst}`"
      class="relative flex items-center gap-2 rounded-lg border border-default bg-default px-3 h-9 text-sm hover:bg-elevated transition-colors"
      :class="[burst ? 'power-pop' : '', p.briefUpdating ? 'charging' : '', unseen ? 'glowing' : '', ready ? 'gold' : '']"
      @click="emit('toggle')"
    >
      <UIcon :name="p.briefUpdating ? 'i-lucide-loader-circle' : unseen ? 'i-lucide-sparkles' : 'i-lucide-file-text'" :class="[p.briefUpdating ? 'animate-spin text-primary' : '', unseen ? 'text-primary' : '']" class="size-4" />
      <span class="font-medium">Brief</span>
      <UBadge v-if="brief?.status === 'ready'" label="Ready" color="success" size="sm" />
      <UBadge v-else :label="`${requiredProgress.done}/${requiredProgress.total}`" color="neutral" variant="subtle" size="sm" />
      <span v-if="unseen" class="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-primary text-inverted text-[11px] font-bold grid place-items-center unseen-dot">+{{ unseen }}</span>
    </button>

    <!-- one-shot effects, re-created on every burst -->
    <div v-if="burst" :key="`fx-${burst}`" class="pointer-events-none absolute inset-0">
      <span class="ring" :class="ready ? 'gold-ring' : ''" />
      <span v-for="a in angles" :key="a" class="spark" :class="ready ? 'gold-spark' : ''" :style="{ '--a': `${a}deg`, '--d': `${a % 72 === 0 ? 44 : 30}px`, animationDelay: `${(a % 3) * 40}ms` }">✦</span>
      <span class="float-gain">{{ ready ? 'Ready!' : `+${gain} updated` }}</span>
    </div>
  </div>
</template>

<style scoped>
.power-pop { animation: pop 600ms cubic-bezier(.2, 1.6, .4, 1); }
.charging { box-shadow: 0 0 0 0 color-mix(in oklab, var(--ui-primary) 50%, transparent); animation: charge 1s ease-in-out infinite; }
.glowing { border-color: var(--ui-primary); box-shadow: 0 0 14px 1px color-mix(in oklab, var(--ui-primary) 55%, transparent); animation: pop 600ms cubic-bezier(.2, 1.6, .4, 1), breathe 2.2s ease-in-out 600ms infinite; }
.gold { border-color: #f5b301; box-shadow: 0 0 22px 3px rgba(245, 179, 1, .6); }
.unseen-dot { animation: bump 1.4s ease-in-out infinite; }
.ring { position: absolute; left: 50%; top: 50%; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 9999px; border: 2px solid var(--ui-primary); animation: ring 900ms ease-out forwards; }
.gold-ring { border-color: #f5b301; }
.spark { position: absolute; left: 50%; top: 50%; font-size: 13px; line-height: 1; color: var(--ui-primary); opacity: 0; animation: spark 1000ms ease-out forwards; }
.gold-spark { color: #f5b301; }
.float-gain { position: absolute; left: 50%; top: -6px; transform: translateX(-50%); white-space: nowrap; font-size: 12px; font-weight: 700; color: var(--ui-primary); animation: floatup 1600ms ease-out forwards; }
@keyframes pop { 0% { transform: scale(1); } 35% { transform: scale(1.14); } 100% { transform: scale(1); } }
@keyframes charge { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--ui-primary) 45%, transparent); } 50% { box-shadow: 0 0 0 6px transparent; } }
@keyframes breathe { 0%, 100% { box-shadow: 0 0 8px 0 color-mix(in oklab, var(--ui-primary) 40%, transparent); } 50% { box-shadow: 0 0 18px 3px color-mix(in oklab, var(--ui-primary) 65%, transparent); } }
@keyframes bump { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
@keyframes ring { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(2.8, 1.6); opacity: 0; } }
@keyframes spark { 0% { transform: translate(-50%, -50%) rotate(var(--a)) translateX(6px) scale(.2); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(-50%, -50%) rotate(var(--a)) translateX(var(--d)) scale(1.1) rotate(180deg); opacity: 0; } }
@keyframes floatup { 0% { opacity: 0; transform: translate(-50%, 4px); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -34px); } }
@media (prefers-reduced-motion: reduce) {
  .power-pop, .charging, .glowing, .unseen-dot, .ring, .spark { animation: none; }
  .float-gain { animation-duration: 1600ms; }
}
</style>
