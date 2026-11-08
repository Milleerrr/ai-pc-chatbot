<script setup lang="ts">
import type { Status } from './state'
const props = defineProps<{ status: Status; dot?: boolean }>()
const map = {
  confirmed: { label: 'Confirmed', color: 'success', icon: 'i-lucide-check', variant: 'subtle' },
  assumed: { label: 'Assumed', color: 'warning', icon: 'i-lucide-circle-help', variant: 'subtle' },
  unknown: { label: 'Unknown', color: 'neutral', icon: 'i-lucide-minus', variant: 'outline' },
  not_needed: { label: 'Not needed', color: 'neutral', icon: 'i-lucide-ban', variant: 'soft' },
} as const
const m = computed(() => map[props.status])
</script>

<template>
  <UBadge v-if="!dot" :label="m.label" :color="m.color" :variant="m.variant" :icon="m.icon" size="sm" />
  <UTooltip v-else :text="m.label">
    <UIcon :name="m.icon" class="size-4" :class="{ 'text-success': status === 'confirmed', 'text-warning': status === 'assumed', 'text-dimmed': status === 'unknown' || status === 'not_needed' }" />
  </UTooltip>
</template>
