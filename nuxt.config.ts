// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2026-09-26",
  devtools: { enabled: true },
  build: {
    transpile: ["trpc-nuxt"],
  },
});
