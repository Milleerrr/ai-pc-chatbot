import { MutationObserver, type QueryClient } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import {
  chatKeys,
  chatListQuery,
  chatMessagesQuery,
  chatTitle,
  startChatMutation,
  type ChatsApi,
  type StartChatDeps,
} from "../../../app/queries/chats";
import { createQueryClient } from "../../../app/queries/client";
import type { ChatMessage, ChatSummary } from "#shared/types/chat";

const existing: ChatSummary = {
  id: "chat-0",
  title: "Gaming rig",
  createdAt: new Date("2026-11-14T10:00:00Z"),
};
const created: ChatSummary = {
  id: "chat-1",
  title: null,
  createdAt: new Date("2026-11-15T10:00:00Z"),
};
const opener: ChatMessage = {
  id: "m1",
  role: "assistant",
  parts: [{ type: "text", text: "What will you mainly use this PC for?" }],
};

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

function fakeApi(overrides: Partial<ChatsApi> = {}): ChatsApi {
  return {
    list: vi.fn(async () => [created, existing]),
    create: vi.fn(async () => ({ chat: created, messages: [opener] })),
    messages: vi.fn(async () => [opener]),
    ...overrides,
  };
}

function fakeDeps(api = fakeApi()): StartChatDeps {
  return {
    api,
    queryClient,
    ensureSession: vi.fn(async () => true),
    navigate: vi.fn(),
  };
}

const startChat = (deps: StartChatDeps) =>
  new MutationObserver(queryClient, startChatMutation(deps)).mutate();

describe("chat queries", () => {
  it("fetches a Chat's Messages under its own key", async () => {
    const api = fakeApi();

    const messages = await queryClient.fetchQuery(
      chatMessagesQuery(api, "chat-1"),
    );

    expect(messages).toEqual([opener]);
    expect(api.messages).toHaveBeenCalledWith("chat-1");
    expect(queryClient.getQueryData(chatKeys.messages("chat-1"))).toEqual([
      opener,
    ]);
  });

  it("follows a reactive Chat id, like a route param", async () => {
    const api = fakeApi();
    const chatId = ref("chat-1");
    const options = chatMessagesQuery(api, chatId);

    await queryClient.fetchQuery(options);
    chatId.value = "chat-2";
    await queryClient.fetchQuery(options);

    expect(api.messages).toHaveBeenLastCalledWith("chat-2");
    expect(queryClient.getQueryData(chatKeys.messages("chat-2"))).toEqual([
      opener,
    ]);
  });

  it("keeps the list and every Chat's Messages under one root key", async () => {
    const api = fakeApi();
    await queryClient.fetchQuery(chatListQuery(api));
    await queryClient.fetchQuery(chatMessagesQuery(api, "chat-1"));

    await queryClient.invalidateQueries({ queryKey: chatKeys.all });

    for (const key of [chatKeys.list(), chatKeys.messages("chat-1")])
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
  });
});

describe("startChatMutation", () => {
  it("makes sure there is a session, creates the Chat and goes to it", async () => {
    const deps = fakeDeps();

    await startChat(deps);

    expect(deps.ensureSession).toHaveBeenCalledOnce();
    expect(deps.navigate).toHaveBeenCalledWith("/chats/chat-1");
  });

  it("caches the new Chat's Messages so opening it needs no fetch", async () => {
    const deps = fakeDeps();

    await startChat(deps);
    await queryClient.ensureQueryData(chatMessagesQuery(deps.api, "chat-1"));

    expect(deps.api.messages).not.toHaveBeenCalled();
  });

  it("marks the list stale so the sidebar refetches it", async () => {
    const deps = fakeDeps();
    queryClient.setQueryData(chatKeys.list(), [existing]);

    await startChat(deps);

    expect(queryClient.getQueryState(chatKeys.list())?.isInvalidated).toBe(
      true,
    );
  });

  it("does nothing when sent to sign in instead", async () => {
    const deps = fakeDeps();
    deps.ensureSession = async () => false;

    const result = await startChat(deps);

    expect(result).toBeNull();
    expect(deps.api.create).not.toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it("reports a failure and stays put", async () => {
    const deps = fakeDeps(
      fakeApi({
        create: async () => {
          throw new Error("offline");
        },
      }),
    );

    await expect(startChat(deps)).rejects.toThrow("offline");
    expect(deps.navigate).not.toHaveBeenCalled();
  });
});

describe("chatTitle", () => {
  it("names an untitled Chat", () => {
    expect(chatTitle({ title: null })).toBe("New chat");
    expect(chatTitle(undefined)).toBe("New chat");
    expect(chatTitle(existing)).toBe("Gaming rig");
  });
});
