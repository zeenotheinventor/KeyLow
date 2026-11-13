import { defineConfig, devices } from "@playwright/test";

// The dev server compiles each route the first time a test opens it, and a cold CI runner took more
// than the default 5 s for the dashboard and setup routes after sign-up. Locally the server is warm
// enough, so only CI gets the longer waits. Retries stay off so a real failure is not hidden.
const isCI = Boolean(process.env["CI"]);

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  timeout: isCI ? 60_000 : 30_000,
  expect: { timeout: isCI ? 30_000 : 5_000 },
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "corepack pnpm --filter @keylow/web dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
  },
});
