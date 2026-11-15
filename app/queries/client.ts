/**
 * The app's QueryClient.
 */

import { TRPCClientError } from "@trpc/client";
import { MutationCache, QueryClient, type QueryKey } from "@tanstack/vue-query";
import type { AppRouter } from "../../server/trpc/routers";

declare module "@tanstack/vue-query" {
  interface Register {
    mutationMeta: {
      // Query keys (or key prefixes) this mutation invalidates
      invalidates?: QueryKey[];
    };
  }
}

const isClientError = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return false;

  const status = (error as TRPCClientError<AppRouter>).data?.httpStatus;

  return typeof status === "number" && status >= 400 && status < 500;
};

export function createQueryClient() {
  const queryClient: QueryClient = new QueryClient({
    // Mutations declare what they change in `meta.invalidates` instead of
    // each writing its own invalidation in `onSuccess`.
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _onMutateResult, mutation) =>
        Promise.all(
          (mutation.meta?.invalidates ?? []).map((queryKey) =>
            queryClient.invalidateQueries({ queryKey }),
          ),
        ),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) =>
          !isClientError(error) && failureCount < 3,
      },
    },
  });

  return queryClient;
}
