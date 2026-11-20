import { useChat } from "@ai-sdk/vue";
import { useQueryClient, type QueryClient } from "@tanstack/vue-query";
import {
  computed,
  onUnmounted,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { createReplyFetcher } from "~/effects/fetchReply";
import { replyInvalidations } from "~/queries/chats";
import { composerLocked, messageListStatus } from "~/reducers/reply";
import { useReplyStore } from "~/stores/reply";

function invalidateReply(queryClient: QueryClient, chatId: string) {
  for (const queryKey of replyInvalidations(chatId))
    void queryClient.invalidateQueries({ queryKey });
}

export function useReply(chatId: MaybeRefOrGetter<string>) {
  const store = useReplyStore();
  const queryClient = useQueryClient();
  const messagesQuery = useChatMessages(chatId);
  const { $api } = useNuxtApp();

  const replyFetcher = createReplyFetcher(({ chatId: id, text, signal }) =>
    $api.chats.send.mutate({ chatId: id, text }, { signal }),
  );

  const chat = useChat(() => {
    const id = toValue(chatId);

    return {
      id,
      transport: replyFetcher,
      onFinish: () => {
        invalidateReply(queryClient, id);
      },
    };
  });

  // The chat hook keeps the live stream. Copy the query in when nothing is
  // streaming, so a refetch can't wipe a reply that's still arriving, and so
  // the hook doesn't mutate the query cache.
  watch(
    () => [toValue(chatId), messagesQuery.data.value] as const,
    ([id, messages]) => {
      if (!messages || chat.id.value !== id) return;
      if (composerLocked(store.model.status)) return;

      chat.messages.value = [...messages];
    },
    { immediate: true },
  );

  watch(
    chat.status,
    (status) => {
      store.dispatch({ type: "chatStatusChanged", status });
    },
    { immediate: true },
  );

  watch(
    () => toValue(chatId),
    (id, previous) => {
      store.dispatch({ type: "reset" });

      if (previous && previous !== id) invalidateReply(queryClient, previous);
    },
  );

  onUnmounted(() => {
    invalidateReply(queryClient, toValue(chatId));
  });

  const status = computed(() => store.model.status);
  const loaded = computed(() => messagesQuery.data.value !== undefined);

  function send(text: string) {
    const trimmed = text.trim();

    if (!loaded.value || !trimmed || composerLocked(status.value)) return false;

    void chat.sendMessage({ text: trimmed });

    return true;
  }

  return {
    messages: chat.messages,
    status,
    listStatus: computed(() => messageListStatus(status.value)),
    locked: computed(() => composerLocked(status.value)),
    loaded,
    isError: computed(() => messagesQuery.isError.value),
    send,
    stop: () => {
      void chat.stop();
    },
  };
}
