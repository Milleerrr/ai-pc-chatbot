import { createTRPCNuxtHandler } from "trpc-nuxt/server";
import { appRouter } from "../../trpc";

export default createTRPCNuxtHandler({
  endpoint: "/api/trpc",
  router: appRouter,
  createContext: (event: any) => ({ event }),
});
