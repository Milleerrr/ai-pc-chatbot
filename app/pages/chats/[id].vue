<script setup lang="ts">
import { isTextUIPart, type UIMessage } from "ai";
import { chatTitle } from "~/queries/chats";

definePageMeta({ layout: "chat" });

const route = useRoute();
const chatId = computed(() => String(route.params.id));

const { list } = useChats();
const reply = useReply(chatId);
const draft = ref("");

const title = computed(() =>
  chatTitle(list.data.value?.find((chat) => chat.id === chatId.value)),
);

const streamingMessageId = computed(() =>
  reply.listStatus.value === "streaming"
    ? reply.messages.value.at(-1)?.id
    : undefined,
);

function onSubmit() {
  if (reply.send(draft.value)) draft.value = "";
}

function markdownText(message: UIMessage, part: UIMessage["parts"][number]) {
  if (message.role !== "assistant" || !isTextUIPart(part)) return;

  return part.text;
}
</script>

<template>
  <UDashboardPanel :id="`chat-${chatId}`">
    <template #header>
      <UDashboardNavbar :title="title" />
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl">
        <UAlert
          v-if="reply.isError.value"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Couldn't open this Chat"
          description="It may have been deleted, or the link is wrong."
        />
        <UChatMessages
          v-if="reply.loaded.value"
          :messages="reply.messages.value"
          :status="reply.listStatus.value"
          :assistant="{ side: 'left', variant: 'naked' }"
          :user="{ side: 'right', variant: 'soft' }"
        >
          <template #indicator>
            <span class="text-sm text-muted">Thinking…</span>
          </template>
          <template #content="message">
            <template
              v-for="(part, index) in message.parts"
              :key="`${message.id}-${index}`"
            >
              <Markdown
                v-if="markdownText(message, part) !== undefined"
                :value="markdownText(message, part)"
                :streaming="message.id === streamingMessageId"
                class="*:first:mt-0 *:last:mb-0"
              />
              <span v-else-if="part.type === 'text'">{{ part.text }}</span>
            </template>
          </template>
        </UChatMessages>
        <div v-else-if="!reply.isError.value" class="space-y-3 py-4">
          <USkeleton class="h-4 w-2/3" />
          <USkeleton class="h-4 w-1/2" />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="mx-auto w-full max-w-3xl px-4 pb-4">
        <UChatPrompt
          v-model="draft"
          :disabled="reply.locked.value || !reply.loaded.value"
          placeholder="Tell the assistant what you need"
          @submit="onSubmit"
        >
          <UChatPromptSubmit
            :status="reply.listStatus.value"
            @stop="reply.stop()"
          />
        </UChatPrompt>
      </div>
    </template>
  </UDashboardPanel>
</template>
