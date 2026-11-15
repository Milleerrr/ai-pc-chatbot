import { httpBatchStreamLink, loggerLink, splitLink } from "@trpc/client";
import superjson from "superjson";
import { createTRPCNuxtClient, httpBatchLink } from "trpc-nuxt/client";
import type { AppRouter } from "../../server/trpc/routers";

const url = "/api/trpc";

export default defineNuxtPlugin(() => {
  const api = createTRPCNuxtClient<AppRouter>({
    links: [
      loggerLink({
        enabled: () => import.meta.dev,
      }),
      splitLink({
        condition: (op) => op.path === "chats.send",
        true: httpBatchStreamLink({ url, transformer: superjson }),
        false: httpBatchLink({ url, transformer: superjson }),
      }),
    ],
  });

  return {
    provide: {
      api,
    },
  };
});
