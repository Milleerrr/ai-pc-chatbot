import { createTRPCNuxtClient, httpBatchLink } from "trpc-nuxt/client";
import type { AppRouter } from "../../server/trpc/routers";
import superjson from "superjson";
import { loggerLink } from "@trpc/client";

export default defineNuxtPlugin(() => {
  const api = createTRPCNuxtClient<AppRouter>({
    links: [
      loggerLink({
        enabled: (opts) => {
          if (
            process.env.NODE_ENV === "development" &&
            opts.direction === "down" &&
            opts.result instanceof Error
          ) {
            console.error(opts.result.message);
          }
          return true;
        },
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
