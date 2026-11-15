import type { UIMessage } from "ai";

export type ChatSummary = {
  id: string;
  title: string | null;
  createdAt: Date;
};

export type ChatMessage = UIMessage;

export type CreatedChat = { chat: ChatSummary; messages: ChatMessage[] };
