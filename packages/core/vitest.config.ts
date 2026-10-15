import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // A 2-core CI runner under load is several times slower than a laptop, so CI gets three times the default.
    testTimeout: process.env.CI ? 15_000 : 5_000,
  },
});
