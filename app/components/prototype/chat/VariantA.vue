<script setup lang="ts">
// Variant A, "Docs split" + B's drawer: Chat list left, Chat centre. The Build Brief is a
// read-only document in a docked drawer that starts CLOSED. A header badge opens it, and
// plays a power-up when the assistant updates the Brief. Meter is a slim bar under the composer.
import { useProto, current, brief, requiredProgress, select, newBuild, menuItems, isChanged } from './state'
const p = useProto()
const shown = computed(() => p.chats.filter(c => (p.sidebarTab === 'archived' ? c.archived : !c.archived)))
const drawer = ref(false)
watch(() => p.scenario, () => { drawer.value = false })
const archivedCount = computed(() => p.chats.filter(c => c.archived).length)
</script>

<template>
  <div class="h-[calc(100vh-3.25rem)] flex bg-default text-default">
    <!-- Sidebar -->
    <aside class="w-72 shrink-0 border-r border-default flex flex-col bg-elevated/30">
      <div class="p-3 flex items-center justify-between">
        <span class="font-semibold">PC Builder</span>
        <UButton icon="i-lucide-square-pen" label="New Build" size="sm" @click="newBuild" />
      </div>
      <div class="px-3 pb-2 flex gap-1 text-sm">
        <UButton :label="'Chats'" size="xs" :variant="p.sidebarTab === 'chats' ? 'soft' : 'ghost'" color="neutral" @click="p.sidebarTab = 'chats'" />
        <UButton :label="`Archived (${archivedCount})`" size="xs" :variant="p.sidebarTab === 'archived' ? 'soft' : 'ghost'" color="neutral" @click="p.sidebarTab = 'archived'" />
      </div>
      <div class="flex-1 overflow-y-auto px-2 space-y-0.5">
        <p v-if="!shown.length" class="px-2 py-6 text-sm text-muted text-center">Nothing here yet.</p>
        <div v-for="c in shown" :key="c.id" class="group flex items-center rounded-md pr-1 hover:bg-elevated" :class="c.id === current?.id ? 'bg-elevated' : ''">
          <button class="flex-1 min-w-0 text-left px-2 py-1.5" @click="select(c.id)">
            <div class="truncate text-sm font-medium">{{ c.title }}</div>
            <div class="text-xs text-muted flex items-center gap-1">
              <UIcon v-if="c.continuedTo" name="i-lucide-lock" class="size-3" />{{ c.updated }}
            </div>
          </button>
          <UDropdownMenu :items="menuItems(c)">
            <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="xs" class="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100" />
          </UDropdownMenu>
        </div>
      </div>
      <div class="p-3 border-t border-default text-xs">
        <template v-if="p.isGuest">
          <div class="text-muted mb-1.5">Guest · your Chats move to your account when you sign in.</div>
          <UButton label="Sign in" size="xs" color="neutral" variant="outline" block />
        </template>
        <div v-else class="flex items-center gap-2"><UAvatar text="B" size="xs" /> <span class="text-muted">ben@arva.ai</span></div>
      </div>
    </aside>

    <!-- Chat -->
    <main class="flex-1 min-w-0 flex flex-col">
      <template v-if="current">
        <header class="h-12 shrink-0 px-4 flex items-center gap-2 border-b border-default">
          <h1 class="font-medium truncate">{{ current.title }}</h1>
          <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" @click="p.renaming = { id: current.id, value: current.title }" />
          <UBadge v-if="current.archived" label="Archived" color="neutral" variant="subtle" size="sm" />
          <span class="flex-1" />
          <PrototypeChatBriefBadge :open="drawer" @toggle="drawer = !drawer" />
        </header>
        <PrototypeChatThread>
          <template #below>
            <div class="pt-1"><PrototypeChatMeter kind="bar" /></div>
          </template>
        </PrototypeChatThread>
      </template>
      <div v-else class="flex-1 grid place-items-center p-6 overflow-y-auto">
        <UCard class="w-full max-w-xl">
          <template #header>
            <h2 class="font-semibold">Let's set up your Build</h2>
            <p class="text-sm text-muted">A few quick questions so the interview can start further along. Skip anything you like.</p>
          </template>
          <PrototypeChatSetupForm layout="card" />
        </UCard>
      </div>
    </main>

    <!-- Brief document -->
    <aside class="shrink-0 overflow-hidden bg-elevated/30 transition-[width] duration-300 ease-out" :class="drawer && current ? 'w-[380px] border-l border-default' : 'w-0'">
     <div class="w-[380px] h-full flex flex-col">
      <header class="h-12 shrink-0 px-4 flex items-center gap-2 border-b border-default">
        <UIcon name="i-lucide-file-text" class="text-muted" />
        <span class="font-medium">Build Brief</span>
        <UBadge v-if="brief?.status === 'ready'" label="Ready" color="success" size="sm" icon="i-lucide-check-check" />
        <UBadge v-else-if="brief" label="In progress" color="neutral" variant="subtle" size="sm" />
        <span class="flex-1" />
        <span v-if="p.briefUpdating" class="text-xs text-primary flex items-center gap-1"><UIcon name="i-lucide-loader-circle" class="animate-spin" />Updating…</span>
        <span v-else-if="brief" class="text-xs text-muted">{{ requiredProgress.done }}/{{ requiredProgress.total }} required</span>
        <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" @click="drawer = false" />
      </header>
      <div v-if="brief && current" class="flex-1 overflow-y-auto p-5 space-y-5">
        <h2 class="text-lg font-semibold leading-snug">{{ brief.headline }}</h2>
        <UProgress :model-value="requiredProgress.done" :max="requiredProgress.total" size="xs" />
        <section v-for="s in brief.sections" :key="s.id">
          <h3 class="text-xs uppercase tracking-wide text-muted mb-1">{{ s.title }}</h3>
          <div class="divide-y divide-default">
            <div v-for="x in s.fields" :key="x.key" class="py-2 flex items-start gap-3 rounded transition-colors duration-700" :class="isChanged(s.id, x.key) ? 'bg-primary/15 -mx-2 px-2' : ''">
              <div class="w-28 shrink-0 text-sm text-muted">{{ x.label }}<span v-if="x.required" class="text-error"> *</span></div>
              <div class="flex-1 text-sm" :class="!x.value ? 'text-dimmed' : ''">{{ x.value || '—' }}</div>
              <PrototypeChatStatusChip :status="x.status" />
            </div>
          </div>
        </section>
        <section v-if="brief.openQuestions.length">
          <h3 class="text-xs uppercase tracking-wide text-muted mb-1">Open questions</h3>
          <ul class="space-y-1.5">
            <li v-for="q in brief.openQuestions" :key="q" class="text-sm flex gap-2"><UIcon name="i-lucide-message-circle-question" class="text-warning mt-0.5 shrink-0" />{{ q }}</li>
          </ul>
        </section>
      </div>
      <div v-else class="flex-1 grid place-items-center p-8 text-center text-sm text-muted">
        Your Build Brief fills in here as we talk. It's read-only, and the assistant keeps it up to date.
      </div>
     </div>
    </aside>
    <PrototypeChatDialogs />
  </div>
</template>
