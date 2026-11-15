<script setup lang="ts">
import { chatTitle } from '~/queries/chats'

definePageMeta({ layout: 'chat' })

const route = useRoute()
const chatId = computed(() => String(route.params.id))

const { list } = useChats()
const messages = useChatMessages(chatId)

const title = computed(() =>
  chatTitle(list.data.value?.find((c) => c.id === chatId.value)),
)
</script>

<template>
  <UDashboardPanel :id="`chat-${chatId}`">
    <template #header>
      <UDashboardNavbar :title="title" />
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl">
        <UAlert
          v-if="messages.isError.value"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Couldn't open this Chat"
          description="It may have been deleted, or the link is wrong."
        />
        <UChatMessages
          v-else-if="messages.data.value"
          :messages="messages.data.value"
          status="ready"
          :assistant="{ side: 'left', variant: 'naked' }"
          :user="{ side: 'right', variant: 'soft' }"
        />
        <div v-else class="space-y-3 py-4">
          <USkeleton class="h-4 w-2/3" />
          <USkeleton class="h-4 w-1/2" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
