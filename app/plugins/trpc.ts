import { createTRPCNuxtClient, httpBatchLink } from "trpc-nuxt/client";
import type { AppRouter } from "../../server/trpc/routers";
import superjson from "superjson";
import { loggerLink } from "@trpc/client";

export default defineNuxtPlugin(() => {
  const api = createTRPCNuxtClient<AppRouter>({
    links: [
      loggerLink({
        enabled: () => import.meta.dev,
      }),
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
      }),
    ],
  });

  return {
    provide: {
      api,
    },
  };
});
