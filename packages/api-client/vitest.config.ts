import { configDefaults, defineConfig } from "vitest/config";

// These files render nothing, so they run in Node and skip creating a jsdom window for each file.
// Every other unit file runs in jsdom, so a new file is safe by default, and a file in the wrong
// project fails at once with "document is not defined".
const NODE_FILES = [
  "test/repos/**/*.test.ts",
  "test/types/**/*.test.ts",
  "test/customFoodInput.test.ts",
  "test/edge.test.ts",
  "test/errors.test.ts",
  "test/index.test.ts",
  "test/invalidateFoodQueries.test.ts",
  "test/queryKeys.test.ts",
  "test/recipeCache.test.ts",
  "test/restingHeat.test.ts",
  "test/todayPlanOf.test.ts",
  "test/hooks/plannedDayOf.test.ts",
  "test/hooks/programHistoryFromDate.test.ts",
  "test/hooks/suggestionEquipmentKey.test.ts",
  "test/hooks/trendReadWindow.test.ts",
];

export default defineConfig({
  test: {
    // Locally a run uses half the cores, so several runs at once do not bury the machine. CI keeps the default.
    ...(process.env.CI ? {} : { maxWorkers: "50%" }),
    setupFiles: ["./test/support/setup.ts"],
    // The integration suite needs the local Supabase stack, so it only runs through vitest.integration.config.ts.
    exclude: [...configDefaults.exclude, "test/integration/**"],
    // A 2-core CI runner under load is several times slower than a laptop, so CI gets three times the default.
    testTimeout: process.env.CI ? 15_000 : 5_000,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: NODE_FILES,
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["test/**/*.test.{ts,tsx}"],
          exclude: [...configDefaults.exclude, "test/integration/**", ...NODE_FILES],
        },
      },
    ],
  },
});
