<script setup lang="ts">
import {
  useProto, current, locked, warning, allowance, composerDisabled, archivedView, usagePct, brief,
  send, stop, retry, startContinuation, looksRight, toggleArchive, select, renderMd,
} from './state'
defineProps<{ inlineReceipts?: boolean; compact?: boolean }>()
const p = useProto()
const input = ref('')
const submit = () => {
  if (!input.value.trim() || composerDisabled.value) return
  send(input.value)
  input.value = ''
}
const pctText = computed(() => `${Math.round(usagePct.value * 100)}%`)
const from = computed(() => p.chats.find(c => c.id === current.value?.continuedFrom))
const to = computed(() => p.chats.find(c => c.id === current.value?.continuedTo))
const placeholder = computed(() =>
  archivedView.value ? 'Archived. Restore this Chat to keep talking.'
    : locked.value ? 'This Chat is full. Continue in a new Chat.'
      : allowance.value.capped ? 'Message limit reached for now.'
        : 'Answer the assistant, or ask anything about your Build…')
const resetAt = computed(() => (allowance.value.capped === 'week' ? 'Sat 14 Nov' : '4:20 pm'))
const showSummary = computed(() => p.summaryOffered && brief.value?.status === 'in_progress')
const scroller = ref<HTMLElement | null>(null)
const toBottom = () => nextTick(() => { if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight })
watch(() => [current.value?.id, current.value?.messages.length, current.value?.messages.at(-1)?.parts[0]?.text.length], toBottom, { flush: 'post' })
onMounted(toBottom)
const receiptsOf = (m: unknown) => ((m as { receipt?: string[] }).receipt ?? [])
</script>

<template>
  <div class="flex flex-col min-h-0 flex-1">
    <div v-if="from" class="flex items-center gap-2 px-4 py-1.5 text-xs text-muted border-b border-default bg-elevated/50">
      <UIcon name="i-lucide-corner-down-right" />
      <span>Continued from <button class="underline hover:text-default" @click="select(from.id)">{{ from.title }}</button>. Your Build Brief carried over.</span>
    </div>

    <div ref="scroller" class="flex-1 min-h-0 overflow-y-auto">
      <UChatMessages
        :messages="current?.messages ?? []"
        :status="p.status === 'error' ? 'ready' : p.status"
        :should-auto-scroll="false" :auto-scroll="false"
        :compact="compact"
        class="px-4 py-4 max-w-3xl mx-auto"
        :assistant="{ side: 'left', variant: 'naked' }"
        :user="{ side: 'right', variant: 'soft' }"
        :ui="{ root: '[&>article]:last-of-type:min-h-0' }"
      >
        <template #content="{ message }">
          <div class="space-y-1 text-sm" v-html="renderMd(message.parts[0]?.text ?? '')" />
          <div v-if="inlineReceipts && receiptsOf(message).length" class="mt-2 flex flex-wrap gap-1.5">
            <UBadge v-for="r in receiptsOf(message)" :key="r" :label="r" color="primary" variant="subtle" size="sm" icon="i-lucide-file-check-2" />
          </div>
        </template>
      </UChatMessages>
    </div>

    <div class="px-4 pb-4 pt-2 max-w-3xl mx-auto w-full space-y-2">
      <UAlert v-if="archivedView" color="neutral" variant="subtle" icon="i-lucide-archive" title="Archived Chat. Read-only until restored."
        :actions="[{ label: 'Restore', color: 'neutral', variant: 'outline', onClick: () => toggleArchive(current!.id) }]" />

      <UAlert v-if="to" color="neutral" variant="subtle" icon="i-lucide-lock" title="Read-only. This Chat was continued."
        :actions="[{ label: 'Open continuation', color: 'neutral', variant: 'outline', onClick: () => select(to!.id) }]" />
      <UAlert v-else-if="locked && !archivedView" color="error" variant="subtle" icon="i-lucide-gauge" title="This Chat reached its Context Limit"
        description="Continue in a new Chat. Your Build Brief and a short summary of where we got to carry over.">
        <template #actions>
          <UButton :loading="p.continuing" :label="p.continuing ? 'Writing summary…' : 'Continue in a new Chat'" color="error" @click="startContinuation" />
        </template>
      </UAlert>
      <UAlert v-else-if="warning && !archivedView" color="warning" variant="subtle" icon="i-lucide-gauge" :title="`This Chat is ${pctText} full`"
        description="It's getting long. You can keep going, then continue in a new Chat when it fills up."
        :actions="[{ label: 'Continue now', color: 'warning', variant: 'outline', onClick: startContinuation }]" />

      <UAlert v-if="allowance.capped" color="warning" variant="subtle" icon="i-lucide-hourglass"
        :title="allowance.capped === 'week' ? 'Weekly message limit reached' : 'Message limit reached for now'"
        :description="p.isGuest ? `You've used your ${allowance.capped === 'week' ? 'weekly ' : ''}guest messages. Sign in for a bigger allowance, or wait until ${resetAt}.` : `You can send again from ${resetAt}. Existing Chats and your Brief stay available.`">
        <template v-if="p.isGuest" #actions><UButton label="Sign in" color="warning" /></template>
      </UAlert>

      <UAlert v-if="p.status === 'error'" color="error" variant="subtle" icon="i-lucide-triangle-alert" title="The reply failed" description="Nothing was lost. Your message is saved."
        :actions="[{ label: 'Retry', color: 'error', variant: 'outline', onClick: retry }]" />

      <UAlert v-if="showSummary" color="primary" variant="subtle" icon="i-lucide-clipboard-check" title="Ready to lock in your Brief?"
        description="Confirming turns every Assumed detail into Confirmed.">
        <template #actions><UButton label="Looks right" @click="looksRight" /></template>
      </UAlert>

      <UChatPrompt v-model="input" :placeholder="placeholder" :disabled="composerDisabled" variant="subtle" @submit="submit">
        <template #footer>
          <span v-if="allowance.low" class="text-xs text-warning">{{ allowance.left }} message{{ allowance.left === 1 ? '' : 's' }} left</span>
          <span v-else-if="!composerDisabled" class="text-xs text-dimmed">Enter to send</span>
          <span v-else />
        </template>
        <UChatPromptSubmit :status="p.status" :disabled="composerDisabled && p.status === 'ready'" @stop="stop" />
      </UChatPrompt>
      <slot name="below" />
    </div>
  </div>
</template>
