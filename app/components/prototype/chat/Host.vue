<script setup lang="ts">
// Throwaway host. Mounted by app/pages/index.vue whenever ?variant= is present.
// Plan: three variants of the Chat v1 screen on the existing `/` route, switchable via ?variant=A|B|C
// and ?scenario= (see SCENARIOS in state.ts).
import { SCENARIOS, setScenario, useProto } from './state'
const route = useRoute()
const p = useProto()
const variants = [
  { key: 'A', name: 'Docs split' },
  { key: 'B', name: 'Focus + drawer' },
  { key: 'C', name: 'Brief canvas' },
]
const v = computed(() => String(route.query.variant ?? 'A').toUpperCase())
onMounted(() => {
  const s = route.query.scenario as string | undefined
  if (s && SCENARIOS.some(x => x.key === s)) setScenario(s as never)
  if (route.query.guest) p.isGuest = true
})
</script>

<template>
  <div>
    <PrototypeChatVariantA v-if="v === 'A'" />
    <PrototypeChatVariantB v-else-if="v === 'B'" />
    <PrototypeChatVariantC v-else-if="v === 'C'" />
    <PrototypeChatSwitcher :variants="variants" />
  </div>
</template>
