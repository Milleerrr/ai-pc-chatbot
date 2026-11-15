/**
 * Composer lock and the reply indicator. The chat hook owns the Messages;
 * this only reacts to its status.
 */

export type ReplyStatus = "idle" | "thinking" | "streaming" | "closed";

export type ReplyModel = {
  status: ReplyStatus;
};

/** Status values the AI SDK chat hook reports. */
type HookStatus = "submitted" | "streaming" | "ready" | "error";

export type ReplyAction =
  | { type: "hook"; status: HookStatus }
  | { type: "reset" };

export const initialReplyModel: ReplyModel = { status: "idle" };

export function composerLocked(status: ReplyStatus): boolean {
  return status === "thinking" || status === "streaming";
}

/** Status prop for the chat message list and the composer button. */
export function messageListStatus(
  status: ReplyStatus,
): "ready" | "submitted" | "streaming" {
  switch (status) {
    case "thinking":
      return "submitted";
    case "streaming":
      return "streaming";
    case "idle":
    case "closed":
      return "ready";
  }
}

export function update(model: ReplyModel, action: ReplyAction): ReplyModel {
  switch (action.type) {
    case "reset":
      return initialReplyModel;
    case "hook":
      return { status: statusFromHook(model.status, action.status) };
  }
}

function statusFromHook(current: ReplyStatus, hook: HookStatus): ReplyStatus {
  switch (hook) {
    case "submitted":
      return "thinking";
    case "streaming":
      return "streaming";
    case "error":
      return "closed";
    case "ready":
      return current === "idle" ? "idle" : "closed";
  }
}
