export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: "2026-09-26",
  nitro: { preset: "node-server" },
  build: { transpile: ["trpc-nuxt"] },
  devtools: { enabled: false },
});
