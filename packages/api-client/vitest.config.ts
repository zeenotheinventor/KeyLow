import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Locally a run uses half the cores, so several runs at once do not bury the machine. CI keeps the default.
    ...(process.env.CI ? {} : { maxWorkers: "50%" }),
    environment: "jsdom",
    setupFiles: ["./test/support/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    // The integration suite needs the local Supabase stack, so it only runs through vitest.integration.config.ts.
    exclude: [...configDefaults.exclude, "test/integration/**"],
    // A 2-core CI runner under load is several times slower than a laptop, so CI gets three times the default.
    testTimeout: process.env.CI ? 15_000 : 5_000,
  },
});
