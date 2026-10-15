import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // The Next tsconfig sets jsx: "preserve", so Vite must be told to compile JSX itself.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    // A 2-core CI runner under load is several times slower than a laptop, so CI gets three times the default.
    testTimeout: process.env.CI ? 15_000 : 5_000,
  },
});
