import { describe, expect, it } from "vitest";
import {
  composerLocked,
  initialReplyModel,
  update,
  type ReplyModel,
} from "../../../app/reducers/reply";

const at = (status: ReplyModel["status"]): ReplyModel => ({ status });

describe("reply status", () => {
  it("locks the composer on thinking before any text arrives", () => {
    const next = update(initialReplyModel, { type: "chatStatusChanged", status: "submitted" });

    expect(next).toEqual({ status: "thinking" });
    expect(composerLocked(next.status)).toBe(true);
  });

  it("unlocks when the stream closes", () => {
    const next = update(at("streaming"), { type: "chatStatusChanged", status: "ready" });

    expect(next).toEqual({ status: "closed" });
    expect(composerLocked(next.status)).toBe(false);
  });

  it("unlocks when the chat reports an error", () => {
    const next = update(at("thinking"), { type: "chatStatusChanged", status: "error" });

    expect(next).toEqual({ status: "closed" });
    expect(composerLocked(next.status)).toBe(false);
  });

  it("treats the chat's initial ready status as idle", () => {
    expect(update(initialReplyModel, { type: "chatStatusChanged", status: "ready" })).toEqual(
      { status: "idle" },
    );
  });
});
