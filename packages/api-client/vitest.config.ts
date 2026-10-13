import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./test/support/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    // The integration suite needs the local Supabase stack, so it only runs through vitest.integration.config.ts.
    exclude: [...configDefaults.exclude, "test/integration/**"],
  },
});
