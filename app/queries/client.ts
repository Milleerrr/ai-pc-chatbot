// The app's QueryClient (ADR 0004). Plain module, no Nuxt, so the `unit`
// project tests the same client the app runs.
import { TRPCClientError } from "@trpc/client";
import {
  MutationCache,
  QueryClient,
  type QueryKey,
} from "@tanstack/vue-query";

declare module "@tanstack/vue-query" {
  interface Register {
    mutationMeta: {
      /**
       * Query keys (or key prefixes) this mutation changes. They are
       * invalidated when it succeeds, and the mutation stays pending until
       * the active ones have refetched.
       */
      invalidates?: QueryKey[];
    };
  }
}

const isClientError = (error: unknown) => {
  const status =
    error instanceof TRPCClientError ? error.data?.httpStatus : undefined;

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
        // Data changes through this app, and mutations invalidate what they
        // touch, so a short window avoids refetching on every mount.
        staleTime: 30_000,
        // A 4xx (not found, forbidden, bad input) won't change on retry.
        retry: (failureCount, error) =>
          !isClientError(error) && failureCount < 3,
      },
    },
  });

  return queryClient;
}
