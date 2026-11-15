import type { ChatsApi } from "~/queries/chats";

/** The tRPC calls behind the chat queries, in the shape `~/queries/chats` takes. */
export function useChatsApi(): ChatsApi {
  const { $api } = useNuxtApp();

  return {
    list: () => $api.chats.list.query(),
    create: () => $api.chats.create.mutate(),
    messages: (chatId) => $api.chats.messages.query({ chatId }),
  };
}
