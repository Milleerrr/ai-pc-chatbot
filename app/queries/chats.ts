// Chat server state (ADR 0004): query keys, query options and the New chat
// mutation. Plain functions over an injected API, so they run in the Node
// `unit` project against a real QueryClient. `useChats()` wires them to tRPC.
import {
  queryOptions,
  type MutationOptions,
  type QueryClient,
} from "@tanstack/vue-query";
import type { UIMessage } from "ai";
import { toValue, type MaybeRefOrGetter } from "vue";

export type ChatSummary = {
  id: string;
  title: string | null;
  createdAt: Date;
};

export type ChatMessage = UIMessage;

export type CreatedChat = { chat: ChatSummary; messages: ChatMessage[] };

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

/**
 * A Chat's Messages. `chatId` may be a ref or getter (a route param): the key
 * tracks it and the fetch reads the id from the key, so they never disagree.
 *
 * Not wrapped in `queryOptions`: its DataTag puts UIMessage into the key's
 * type, and Vue Query's DeepUnwrapRef over the key then recurses until TS
 * gives up (TS2589).
 */
export const chatMessagesQuery = (
  api: ChatsApi,
  chatId: MaybeRefOrGetter<string>,
) => ({
  queryKey: () => chatKeys.messages(toValue(chatId)),
  queryFn: ({ queryKey: [, id] }: { queryKey: MessagesKey }) =>
    api.messages(id),
});

export const chatPath = (chatId: string) => `/chats/${chatId}`;

/** What the UI calls a Chat that has no title yet. */
export const chatTitle = (chat: Pick<ChatSummary, "title"> | undefined) =>
  chat?.title ?? "New chat";

export type StartChatDeps = {
  api: ChatsApi;
  queryClient: QueryClient;
  /** Resolves false when the user was sent to sign in instead. */
  ensureSession(): Promise<boolean>;
  navigate(path: string): unknown;
};

/**
 * New chat: make sure there is a session (creating a Guest if needed), create
 * the Chat and go to it. The list refreshes through `meta.invalidates`; the
 * opener is cached by hand because the user lands on the Chat right away.
 * Resolves `null` when the user was sent to sign in instead.
 */
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
