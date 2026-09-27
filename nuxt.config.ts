// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiUrl: process.env.API_URL,
      dbCredentials: {
        url: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV !== "development" ? true : false,
      },
    },
  },
  compatibilityDate: "2026-09-26",
  devtools: { enabled: true },
  build: {
    transpile: ["trpc-nuxt"],
  },
  modules: ["@nuxt/ui"],
  css: ["~/assets/css/main.css"],
});
