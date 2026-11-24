import { defineConfig } from "vitest/config";

/**
 * Monorepo unit tests (logic-first). Soft coverage gate applies to packages/api only
 * via `npm run test:coverage:api`.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: [
      "packages/*/src/**/*.test.ts",
      "apps/customer-app/lib/**/*.test.ts",
      "apps/technician-app/lib/**/*.test.ts",
      "apps/customer-app/lib/**/*.smoke.test.ts",
      "apps/technician-app/lib/**/*.smoke.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.expo/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: ["packages/*/src/**/*.ts", "apps/*/lib/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.smoke.test.ts",
        "**/database.types.ts",
        "**/index.ts",
        "**/node_modules/**",
        "**/*.{native,web}.ts",
      ],
    },
  },
});
