<script setup lang="ts">
// Variant B, "Focus + drawer": the Chat is the whole screen. Sidebar groups Chats by Build
// (Continuations nest under their Build). The Brief lives in a slide-over opened from a
// header pill, and Brief changes show up inline in the thread as receipts. Meter is a ring.
import { useProto, current, brief, requiredProgress, select, newBuild, menuItems } from './state'
const p = useProto()
const drawer = ref(false)
const builds = computed(() => {
  const ids = [...new Set(p.chats.filter(c => !c.archived).map(c => c.buildId))]
  return ids.map(id => ({ id, head: p.briefs[id]?.headline ?? '', chats: p.chats.filter(c => c.buildId === id && !c.archived) }))
})
const archived = computed(() => p.chats.filter(c => c.archived))
const showArchived = ref(false)
watch(() => p.scenario, s => { showArchived.value = s === 'archived'; if (s === 'new-build') drawer.value = false })
</script>

<template>
  <div class="h-[calc(100vh-3.25rem)] flex bg-default text-default">
    <aside class="w-64 shrink-0 flex flex-col bg-elevated/40 border-r border-default">
      <div class="p-3"><UButton icon="i-lucide-plus" label="New Build" color="neutral" variant="outline" block @click="newBuild" /></div>
      <div class="flex-1 overflow-y-auto px-2 pb-2 text-sm">
        <div v-for="b in builds" :key="b.id" class="mb-3">
          <div class="px-2 pb-1 text-[11px] uppercase tracking-wide text-muted truncate" :title="b.head">Build · {{ b.head }}</div>
          <div v-for="(c, i) in b.chats" :key="c.id" class="group flex items-center rounded-md hover:bg-elevated" :class="[c.id === current?.id ? 'bg-elevated' : '', i > 0 ? 'ml-4' : '']">
            <UIcon v-if="i > 0" name="i-lucide-corner-down-right" class="size-3.5 text-muted shrink-0 ml-1" />
            <button class="flex-1 min-w-0 text-left px-2 py-1.5 flex items-center gap-1.5" @click="select(c.id)">
              <span class="truncate">{{ c.title }}</span><UIcon v-if="c.continuedTo" name="i-lucide-lock" class="size-3 text-muted shrink-0" />
            </button>
            <UDropdownMenu :items="menuItems(c)"><UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="xs" class="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100" /></UDropdownMenu>
          </div>
        </div>
        <button class="w-full flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-default" @click="showArchived = !showArchived">
          <UIcon :name="showArchived ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" />Archived ({{ archived.length }})
        </button>
        <div v-if="showArchived">
          <div v-for="c in archived" :key="c.id" class="group flex items-center rounded-md hover:bg-elevated" :class="c.id === current?.id ? 'bg-elevated' : ''">
            <button class="flex-1 min-w-0 text-left px-2 py-1.5 truncate text-muted" @click="select(c.id)">{{ c.title }}</button>
            <UDropdownMenu :items="menuItems(c)"><UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="xs" class="opacity-0 group-hover:opacity-100" /></UDropdownMenu>
          </div>
        </div>
      </div>
      <div class="p-3 border-t border-default text-xs text-muted">
        <template v-if="p.isGuest">Guest · <button class="underline">sign in</button> to keep your Chats</template>
        <template v-else>Signed in as ben@arva.ai</template>
      </div>
    </aside>

    <main class="flex-1 min-w-0 flex flex-col">
      <template v-if="current">
        <header class="h-14 shrink-0 px-5 flex items-center gap-3">
          <button class="font-medium truncate hover:underline decoration-dotted" @click="p.renaming = { id: current.id, value: current.title }">{{ current.title }}</button>
          <span class="flex-1" />
          <PrototypeChatMeter kind="ring" />
          <UButton color="neutral" variant="outline" size="md" class="gap-2" @click="drawer = true">
            <UIcon :name="p.briefUpdating ? 'i-lucide-loader-circle' : 'i-lucide-file-text'" :class="p.briefUpdating ? 'animate-spin text-primary' : ''" />
            <span>Brief</span>
            <UBadge v-if="brief?.status === 'ready'" label="Ready" color="success" size="sm" />
            <UBadge v-else :label="`${requiredProgress.done}/${requiredProgress.total}`" color="neutral" variant="subtle" size="sm" />
            <span v-if="p.changed.length" class="size-2 rounded-full bg-primary animate-pulse" />
          </UButton>
        </header>
        <PrototypeChatThread inline-receipts />
      </template>
      <div v-else class="flex-1 grid place-items-center p-6 overflow-y-auto">
        <div class="w-full max-w-md">
          <h2 class="text-2xl font-semibold mb-1">What are we building?</h2>
          <p class="text-muted text-sm mb-6">Answer what you can. "Not sure" is always fine, and you can skip all of it.</p>
          <PrototypeChatSetupForm layout="chips" />
        </div>
      </div>
    </main>

    <USlideover v-model:open="drawer" side="right" title="Build Brief" :description="brief?.headline" :ui="{ content: 'max-w-md' }">
      <template #body>
        <div v-if="brief" class="space-y-6">
          <div class="flex items-center gap-2 text-sm">
            <UBadge v-if="brief.status === 'ready'" label="Ready" color="success" icon="i-lucide-check-check" />
            <UBadge v-else label="In progress" color="neutral" variant="subtle" />
            <span class="text-muted">{{ requiredProgress.done }} of {{ requiredProgress.total }} required details confirmed</span>
          </div>
          <div v-if="p.briefUpdating" class="text-sm text-primary flex items-center gap-2"><UIcon name="i-lucide-loader-circle" class="animate-spin" />Updating from your last message…</div>
          <section v-for="s in brief.sections" :key="s.id">
            <h3 class="font-medium mb-2">{{ s.title }}</h3>
            <dl class="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm">
              <template v-for="x in s.fields" :key="x.key">
                <dt class="text-muted">{{ x.label }}</dt>
                <dd class="flex items-center gap-2 rounded px-1 -mx-1 transition-colors duration-700" :class="p.changed.includes(`${s.id}.${x.key}`) ? 'bg-primary/15' : ''">
                  <PrototypeChatStatusChip :status="x.status" dot /><span :class="!x.value ? 'text-dimmed' : ''">{{ x.value || 'Unknown' }}</span>
                </dd>
              </template>
            </dl>
          </section>
          <section v-if="brief.openQuestions.length">
            <h3 class="font-medium mb-2">Open questions</h3>
            <ul class="text-sm space-y-1.5 list-disc pl-5"><li v-for="q in brief.openQuestions" :key="q">{{ q }}</li></ul>
          </section>
        </div>
      </template>
    </USlideover>
    <PrototypeChatDialogs />
  </div>
</template>
