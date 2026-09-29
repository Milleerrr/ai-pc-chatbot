// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  runtimeConfig: {
    dbCredentials: {
      url: process.env.DATABASE_URL ?? "",
      ssl: process.env.DATABASE_SSL === "true",
    },
    public: {
      apiUrl: process.env.API_URL,
    },
  },
  compatibilityDate: "2026-09-26",
  devtools: { enabled: true },
  build: {
    transpile: ["trpc-nuxt"],
  },
  modules: ["@nuxt/ui", "@nuxt/test-utils/module"],
  css: ["~/assets/css/main.css"],
  typescript: {
    // Paths are relative to `.nuxt/tsconfig.node.json`.
    nodeTsConfig: {
      include: ["../drizzle.config.ts"],
    },
  },
});
