import type { MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { chatMessagesQuery } from "~/queries/chats";

/** The Messages of one Chat, refetched when `chatId` changes (ADR 0004). */
export function useChatMessages(chatId: MaybeRefOrGetter<string>) {
  return useQuery(chatMessagesQuery(useChatsApi(), chatId));
}
