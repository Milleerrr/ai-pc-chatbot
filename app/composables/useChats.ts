import { computed } from "vue";
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import {
  chatKeys,
  chatListQuery,
  startChatMutation,
} from "~/queries/chats";

/**
 * The Chat list and New chat (ADR 0004: server state lives in Vue Query).
 * Several components call this; they share one cache, and the New chat state
 * comes from the mutation cache so every "New chat" button agrees.
 */
export function useChats() {
  const api = useChatsApi();
  const queryClient = useQueryClient();
  const ensureSession = useEnsureSession();

  const list = useQuery(chatListQuery(api));
  const { mutate } = useMutation(
    startChatMutation({
      api,
      queryClient,
      ensureSession,
      navigate: (path) => navigateTo(path),
    }),
  );

  const startStatuses = useMutationState({
    filters: { mutationKey: chatKeys.start() },
    select: (mutation) => mutation.state.status,
  });
  const startStatus = computed(() => startStatuses.value.at(-1) ?? "idle");
  const creating = computed(() => startStatus.value === "pending");

  return {
    list,
    creating,
    createFailed: computed(() => startStatus.value === "error"),
    /** One Chat (and one Guest) per click, even across buttons. */
    create: () => {
      if (!creating.value) mutate();
    },
  };
}
