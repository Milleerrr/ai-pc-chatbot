// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";
import tseslint from "typescript-eslint";

/** @param {import("typescript-eslint").ConfigArray} configs */
const rulesFrom = (configs) =>
  Object.assign({}, ...configs.map((config) => config.rules ?? {}));

// Same TypeScript rule overrides as platform's eslint.config.mjs.
// `@nuxt/eslint` supplies Vue and the recommended type-checked preset
// (strict is off in nuxt.config.ts). Stylistic type-checked rules are
// added here because the Nuxt preset does not include them.
const tsRules = {
  "@typescript-eslint/array-type": "off",
  "@typescript-eslint/consistent-type-definitions": "off",
  "@typescript-eslint/consistent-type-imports": [
    "warn",
    {
      prefer: "type-imports",
      fixStyle: "inline-type-imports",
    },
  ],
  "@typescript-eslint/no-unused-vars": [
    "warn",
    {
      argsIgnorePattern: "^_",
    },
  ],
  "@typescript-eslint/no-unused-private-class-members": "warn",
  "@typescript-eslint/require-await": "off",
  "@typescript-eslint/no-misused-promises": [
    "error",
    {
      checksVoidReturn: {
        attributes: false,
      },
    },
  ],
  "@typescript-eslint/no-floating-promises": "error",
  "no-console": ["warn"],
  "array-callback-return": ["error", { allowImplicit: true }],
};

export default withNuxt(
  {
    ignores: [
      "**/.nuxt/**",
      "**/.output/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/shared/db/migrations/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,mts,cts,vue}"],
    rules: {
      ...rulesFrom(tseslint.configs.stylistic),
      ...rulesFrom(tseslint.configs.stylisticTypeChecked),
      ...tsRules,
    },
  },
  {
    files: ["test/**/*.ts", "vitest.config.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        projectService: false,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // expect(mock.method) inspects the mock. It does not call it unbound.
      "@typescript-eslint/unbound-method": "off",
    },
  },
);
