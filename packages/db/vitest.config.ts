import { defineConfig } from "vitest/config";

// Unit tests only. The suites that need the Supabase stack have their own configs.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/unit/**/*.test.ts"],
  },
});
