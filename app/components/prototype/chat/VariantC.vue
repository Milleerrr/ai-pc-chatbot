<script setup lang="ts">
// Variant C, "Brief canvas": flips the hierarchy. The Build Brief is the main page,
// a big readable document in a two-column grid, and the Chat is a narrow copilot column.
// No permanent sidebar: a Chat switcher popover in the top bar. Setup Form is the empty
// Brief itself. Meter is a segmented gauge in the top bar.
import { useProto, current, brief, requiredProgress, select, newBuild, menuItems, isChanged } from './state'
const p = useProto()
const tab = ref<'chats' | 'archived'>('chats')
const list = computed(() => p.chats.filter(c => (tab.value === 'archived' ? c.archived : !c.archived)))
watch(() => p.scenario, s => { tab.value = s === 'archived' ? 'archived' : 'chats' })
const open = ref(false)
const pick = (id: string) => { select(id); open.value = false }
const pickNew = () => { newBuild(); open.value = false }
</script>

<template>
  <div class="h-[calc(100vh-3.25rem)] flex flex-col bg-default text-default">
    <header class="h-14 shrink-0 px-4 flex items-center gap-3 border-b border-default">
      <UPopover v-model:open="open" :content="{ align: 'start' }">
        <UButton color="neutral" variant="ghost" trailing-icon="i-lucide-chevrons-up-down" class="max-w-xs">
          <span class="truncate font-medium">{{ current?.title ?? 'New Build' }}</span>
        </UButton>
        <template #content>
          <div class="w-80 p-2">
            <div class="flex gap-1 mb-2">
              <UButton label="Chats" size="xs" color="neutral" :variant="tab === 'chats' ? 'soft' : 'ghost'" @click="tab = 'chats'" />
              <UButton label="Archived" size="xs" color="neutral" :variant="tab === 'archived' ? 'soft' : 'ghost'" @click="tab = 'archived'" />
              <span class="flex-1" /><UButton icon="i-lucide-plus" label="New Build" size="xs" @click="pickNew" />
            </div>
            <div class="max-h-72 overflow-y-auto">
              <div v-for="c in list" :key="c.id" class="group flex items-center rounded hover:bg-elevated">
                <button class="flex-1 min-w-0 text-left px-2 py-1.5 text-sm" @click="pick(c.id)">
                  <div class="truncate">{{ c.title }}</div>
                  <div class="text-xs text-muted">{{ c.updated }}<span v-if="c.continuedTo"> · continued</span></div>
                </button>
                <UDropdownMenu :items="menuItems(c)"><UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="xs" /></UDropdownMenu>
              </div>
              <p v-if="!list.length" class="text-sm text-muted text-center py-4">Nothing here yet.</p>
            </div>
          </div>
        </template>
      </UPopover>
      <UButton v-if="current" icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" @click="p.renaming = { id: current.id, value: current.title }" />
      <span class="flex-1" />
      <PrototypeChatMeter v-if="current" kind="segments" />
      <template v-if="p.isGuest"><UButton label="Sign in" size="sm" color="neutral" variant="outline" /></template>
      <UAvatar v-else text="B" size="sm" />
    </header>

    <div class="flex-1 min-h-0 flex">
      <!-- Canvas -->
      <main class="flex-1 min-w-0 overflow-y-auto">
        <div v-if="brief && current" class="max-w-4xl mx-auto px-8 py-8 space-y-6">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <UBadge v-if="brief.status === 'ready'" label="Ready" color="success" icon="i-lucide-check-check" />
              <UBadge v-else label="In progress" color="neutral" variant="subtle" />
              <span v-if="p.briefUpdating" class="text-sm text-primary flex items-center gap-1"><UIcon name="i-lucide-loader-circle" class="animate-spin" />Updating…</span>
              <span class="flex-1" /><span class="text-xs text-muted uppercase tracking-wide">Build Brief · read-only</span>
            </div>
            <h1 class="text-3xl font-semibold leading-tight">{{ brief.headline }}</h1>
            <div class="mt-4 flex items-center gap-1.5">
              <span v-for="i in requiredProgress.total" :key="i" class="h-1.5 flex-1 rounded-full" :class="i <= requiredProgress.done ? 'bg-primary' : 'bg-accented'" />
            </div>
            <p class="text-xs text-muted mt-1.5">{{ requiredProgress.done }} of {{ requiredProgress.total }} required details confirmed</p>
          </div>

          <UAlert v-if="brief.openQuestions.length" color="warning" variant="subtle" icon="i-lucide-message-circle-question" title="Waiting on your answer">
            <template #description><ul class="space-y-1"><li v-for="q in brief.openQuestions" :key="q">{{ q }}</li></ul></template>
          </UAlert>

          <div class="grid grid-cols-2 gap-4">
            <UCard v-for="s in brief.sections" :key="s.id" :ui="{ body: 'p-4 sm:p-4' }">
              <h2 class="text-sm font-semibold mb-3">{{ s.title }}</h2>
              <div class="space-y-3">
                <div v-for="x in s.fields" :key="x.key" class="rounded-md transition-colors duration-700" :class="isChanged(s.id, x.key) ? 'bg-primary/15 -m-1 p-1' : ''">
                  <div class="flex items-center justify-between text-xs text-muted mb-0.5">
                    <span>{{ x.label }}<span v-if="x.required" class="text-error"> *</span></span>
                    <PrototypeChatStatusChip :status="x.status" />
                  </div>
                  <div class="text-sm" :class="!x.value ? 'text-dimmed italic' : ''">{{ x.value || 'Not established yet' }}</div>
                </div>
              </div>
            </UCard>
          </div>
        </div>
        <div v-else class="max-w-xl mx-auto px-8 py-10">
          <p class="text-xs uppercase tracking-wide text-muted mb-2">Build Brief · new</p>
          <h1 class="text-3xl font-semibold mb-1">Start your Build Brief</h1>
          <p class="text-muted text-sm mb-6">Fill in what you know. It goes straight into the Brief as Confirmed, and the assistant picks up the rest in Chat.</p>
          <PrototypeChatSetupForm layout="doc" />
        </div>
      </main>

      <!-- Copilot chat -->
      <aside class="w-[420px] shrink-0 border-l border-default flex flex-col bg-elevated/20">
        <template v-if="current">
          <PrototypeChatThread compact inline-receipts />
        </template>
        <div v-else class="flex-1 grid place-items-center p-8 text-center text-sm text-muted">The Chat opens here once the Build is set up.</div>
      </aside>
    </div>
    <PrototypeChatDialogs />
  </div>
</template>
