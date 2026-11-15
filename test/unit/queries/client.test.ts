import { TRPCClientError } from "@trpc/client";
import { MutationObserver, QueryObserver } from "@tanstack/vue-query";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../../app/queries/client";

const listKey = ["things", "list"] as const;
const otherKey = ["other"] as const;

function seeded() {
  const queryClient = createQueryClient();
  queryClient.setQueryData(listKey, ["a"]);
  queryClient.setQueryData(otherKey, ["b"]);

  return queryClient;
}

describe("meta.invalidates", () => {
  it("invalidates the keys a mutation declares, by prefix, and nothing else", async () => {
    const queryClient = seeded();

    await new MutationObserver(queryClient, {
      mutationFn: async () => "ok",
      meta: { invalidates: [["things"]] },
    }).mutate();

    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
  });

  it("leaves the cache alone for a mutation that declares nothing", async () => {
    const queryClient = seeded();

    await new MutationObserver(queryClient, {
      mutationFn: async () => "ok",
    }).mutate();

    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false);
  });

  it("keeps the mutation pending until an on-screen query has refetched", async () => {
    const queryClient = createQueryClient();
    const fetchList = vi.fn(async () => ["a"]);
    const observer = new QueryObserver(queryClient, {
      queryKey: listKey,
      queryFn: fetchList,
    });
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(fetchList).toHaveBeenCalledOnce());

    await new MutationObserver(queryClient, {
      mutationFn: async () => "ok",
      meta: { invalidates: [listKey] },
    }).mutate();

    expect(fetchList).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("does not invalidate when the mutation fails", async () => {
    const queryClient = seeded();

    await expect(
      new MutationObserver(queryClient, {
        mutationFn: async () => {
          throw new Error("offline");
        },
        meta: { invalidates: [listKey] },
      }).mutate(),
    ).rejects.toThrow("offline");

    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false);
  });
});

describe("query retries", () => {
  const notFound = () =>
    new TRPCClientError("Not found", {
      result: {
        error: { code: -32004, message: "Not found", data: { httpStatus: 404 } },
      },
    });

  it("doesn't retry a 4xx", async () => {
    const queryFn = vi.fn(async () => {
      throw notFound();
    });

    await expect(
      createQueryClient().fetchQuery({ queryKey: ["x"], queryFn }),
    ).rejects.toThrow("Not found");

    expect(queryFn).toHaveBeenCalledOnce();
  });

  it("retries other failures", () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry;

    expect(typeof retry).toBe("function");
    if (typeof retry !== "function") return;
    expect(retry(0, new Error("network"))).toBe(true);
    expect(retry(3, new Error("network"))).toBe(false);
    expect(retry(0, notFound())).toBe(false);
  });
});
