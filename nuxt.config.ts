// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  runtimeConfig: {
    dbCredentials: {
      url: process.env.DATABASE_URL ?? "",
      appUrl: process.env.APP_DATABASE_URL ?? "",
      ssl: process.env.DATABASE_SSL === "true",
    },
    auth: {
      baseURL: process.env.BETTER_AUTH_URL ?? "",
      secret: process.env.BETTER_AUTH_SECRET ?? "",
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      },
      betterAuthApiKey: process.env.BETTER_AUTH_API_KEY ?? "",
    },
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    models: {
      main: process.env.MAIN_MODEL ?? "gemini-3.8-flash",
      fallback: process.env.FALLBACK_MODEL ?? "gemini-3.5-flash-lite",
      maxOutputTokens: Number(process.env.MAX_OUTPUT_TOKENS ?? 8192),
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
  modules: [
    "@nuxt/ui",
    "@comark/vue/nuxt",
    "@pinia/nuxt",
    "@nuxt/test-utils/module",
    "@nuxt/eslint",
  ],
  css: ["~/assets/css/main.css"],
  eslint: {
    config: {
      typescript: {
        // Recommended type-checked rules, matching platform. Strict is a larger set.
        strict: false,
        tsconfigPath: "./tsconfig.json",
      },
    },
  },
  typescript: {
    // Paths are relative to `.nuxt/tsconfig.node.json`.
    nodeTsConfig: {
      include: ["../drizzle.config.ts"],
      // Tests are linted against this config (tsconfig.eslint.json) and import
      // app and server modules that use `#shared` (ADR 0005).
      compilerOptions: {
        paths: {
          "#shared": ["../shared"],
          "#shared/*": ["../shared/*"],
        },
      },
    },
  },
});
