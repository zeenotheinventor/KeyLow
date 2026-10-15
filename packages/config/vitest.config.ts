import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Locally a run uses half the cores, so several runs at once do not bury the machine. CI keeps the default.
    ...(process.env.CI ? {} : { maxWorkers: "50%" }),
    include: ["test/**/*.test.ts"],
    // Fixture projects carry their own tests, which run in a nested vitest process.
    exclude: [...configDefaults.exclude, "test/fixtures/**"],
    // Type-aware linting starts a TypeScript program per fixture, which is slow on a cold cache.
    testTimeout: 60_000,
  },
});
