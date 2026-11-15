import { describe, expect, it } from "vitest";
import {
  composerLocked,
  initialReplyModel,
  messageListStatus,
  update,
  type ReplyModel,
} from "../../../app/reducers/reply";

const at = (status: ReplyModel["status"]): ReplyModel => ({ status });

describe("reply status", () => {
  it("starts idle with the composer unlocked", () => {
    expect(initialReplyModel).toEqual({ status: "idle" });
    expect(composerLocked(initialReplyModel.status)).toBe(false);
  });

  it("locks the composer on thinking before any text arrives", () => {
    const next = update(initialReplyModel, { type: "hook", status: "submitted" });

    expect(next).toEqual({ status: "thinking" });
    expect(composerLocked(next.status)).toBe(true);
  });

  it("stays locked while the reply is streaming", () => {
    const thinking = update(initialReplyModel, {
      type: "hook",
      status: "submitted",
    });
    const next = update(thinking, { type: "hook", status: "streaming" });

    expect(next).toEqual({ status: "streaming" });
    expect(composerLocked(next.status)).toBe(true);
  });

  it("unlocks when the stream closes", () => {
    const next = update(at("streaming"), { type: "hook", status: "ready" });

    expect(next).toEqual({ status: "closed" });
    expect(composerLocked(next.status)).toBe(false);
  });

  it("unlocks when the hook reports an error", () => {
    const next = update(at("thinking"), { type: "hook", status: "error" });

    expect(next).toEqual({ status: "closed" });
    expect(composerLocked(next.status)).toBe(false);
  });

  it("treats the hook's initial ready status as idle", () => {
    expect(update(initialReplyModel, { type: "hook", status: "ready" })).toEqual(
      { status: "idle" },
    );
  });

  it("locks again when the next reply starts", () => {
    const next = update(at("closed"), { type: "hook", status: "submitted" });

    expect(next).toEqual({ status: "thinking" });
    expect(composerLocked(next.status)).toBe(true);
  });

  it("returns to idle when the open Chat changes", () => {
    expect(update(at("streaming"), { type: "reset" })).toEqual({
      status: "idle",
    });
  });

  it("shows the thinking indicator before text, then the stream", () => {
    expect(messageListStatus("idle")).toBe("ready");
    expect(messageListStatus("thinking")).toBe("submitted");
    expect(messageListStatus("streaming")).toBe("streaming");
    expect(messageListStatus("closed")).toBe("ready");
  });
});
