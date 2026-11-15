/**
 * Plain functions over an injected API, so they run in the Node `unit` project against
 * a real QueryClient.
 *
 * `useChats()` wires them to tRPC.
 */

import {
  queryOptions,
  type MutationOptions,
  type QueryClient,
} from "@tanstack/vue-query";
import { toValue, type MaybeRefOrGetter } from "vue";
import type {
  ChatMessage,
  ChatSummary,
  CreatedChat,
} from "#shared/types/chat";

export type ChatsApi = {
  list(): Promise<ChatSummary[]>;
  create(): Promise<CreatedChat>;
  messages(chatId: string): Promise<ChatMessage[]>;
};

export const chatKeys = {
  all: ["chats"] as const,
  list: () => [...chatKeys.all, "list"] as const,
  messages: (chatId: string) => [...chatKeys.all, chatId, "messages"] as const,
  start: () => [...chatKeys.all, "start"] as const,
};

export const chatListQuery = (api: ChatsApi) =>
  queryOptions({ queryKey: chatKeys.list(), queryFn: () => api.list() });

type MessagesKey = ReturnType<typeof chatKeys.messages>;

export const chatMessagesQuery = (
  api: ChatsApi,
  chatId: MaybeRefOrGetter<string>,
) => ({
  queryKey: () => chatKeys.messages(toValue(chatId)),
  queryFn: ({ queryKey: [, id] }: { queryKey: MessagesKey }) =>
    api.messages(id),
});

export const chatPath = (chatId: string) => `/chats/${chatId}`;

export const chatTitle = (chat: Pick<ChatSummary, "title"> | undefined) =>
  chat?.title ?? "New chat";

export type StartChatDeps = {
  api: ChatsApi;
  queryClient: QueryClient;
  ensureSession(): Promise<boolean>;
  navigate(path: string): unknown;
};

export const startChatMutation = (
  deps: StartChatDeps,
): MutationOptions<CreatedChat | null, Error, void> => ({
  mutationKey: chatKeys.start(),
  meta: { invalidates: [chatKeys.list()] },
  mutationFn: async () => {
    if (!(await deps.ensureSession())) return null;

    return deps.api.create();
  },
  onSuccess: async (created) => {
    if (!created) return;

    deps.queryClient.setQueryData(
      chatKeys.messages(created.chat.id),
      created.messages,
    );

    await deps.navigate(chatPath(created.chat.id));
  },
});
