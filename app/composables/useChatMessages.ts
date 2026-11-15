import type { MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { chatMessagesQuery } from "~/queries/chats";

export function useChatMessages(chatId: MaybeRefOrGetter<string>) {
  return useQuery(chatMessagesQuery(useChatsApi(), chatId));
}
