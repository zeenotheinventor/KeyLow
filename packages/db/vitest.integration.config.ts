import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    // The suites under database/ need only the stack and run from vitest.database.config.ts.
    exclude: [...configDefaults.exclude, "test/integration/database/**"],
    globalSetup: ["./test/integration/support/globalSetup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
