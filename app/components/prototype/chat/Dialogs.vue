<script setup lang="ts">
import { useProto, commitRename, confirmDelete, current } from './state'
const p = useProto()
const deletingTitle = computed(() => p.chats.find(c => c.id === p.deleting)?.title)
</script>

<template>
  <UModal :open="!!p.renaming" title="Rename Chat" description="A name you set always wins over the auto-generated title." @update:open="v => { if (!v) p.renaming = null }">
    <template #body>
      <UInput v-if="p.renaming" v-model="p.renaming.value" class="w-full" autofocus @keydown.enter="commitRename" />
    </template>
    <template #footer>
      <UButton label="Cancel" color="neutral" variant="ghost" @click="p.renaming = null" />
      <UButton label="Save" @click="commitRename" />
    </template>
  </UModal>

  <UModal :open="!!p.deleting" title="Delete this Chat?" @update:open="v => { if (!v) p.deleting = null }">
    <template #body>
      <p class="text-sm text-muted">
        <strong>{{ deletingTitle }}</strong> will disappear everywhere. <strong>You can't undo this.</strong>
        If you only want it out of the way, archive it instead.
      </p>
    </template>
    <template #footer>
      <UButton label="Cancel" color="neutral" variant="ghost" @click="p.deleting = null" />
      <UButton label="Delete Chat" color="error" @click="confirmDelete" />
    </template>
  </UModal>
</template>
