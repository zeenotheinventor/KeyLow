import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Type-aware linting starts a TypeScript program per fixture, which is slow on a cold cache.
    testTimeout: 60_000,
  },
});
