import { defineConfig } from "vitest/config";

// Unit tests only. The suites that need the Supabase stack have their own configs.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/unit/**/*.test.ts"],
    // A 2-core CI runner under load is several times slower than a laptop, so CI gets three times the default.
    testTimeout: process.env.CI ? 15_000 : 5_000,
  },
});
