import { defineConfig } from "vitest/config";

// Integration tests that need only the local database. The Edge Function suites are in
// vitest.integration.config.ts, which also needs the functions served and the OFF mock.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/database/**/*.test.ts"],
    globalSetup: ["./test/integration/support/databaseSetup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
