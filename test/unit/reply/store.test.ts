import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useReplyStore } from "../../../app/stores/reply";

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("reply store", () => {
  it("changes the composer lock only through dispatch", () => {
    const store = useReplyStore();

    expect(store.model.status).toBe("idle");

    store.dispatch({ type: "hook", status: "submitted" });

    expect(store.model.status).toBe("thinking");
  });
});
