import { defineConfig } from "vitest/config";

// These files swap modules or globals (vi.mock, vi.doMock, vi.resetModules, vi.stubGlobal), so each
// one gets a fresh module graph. Every other file is pure, so the files that run in one worker share
// the modules they import and skip loading them again.
const FILES_THAT_NEED_ISOLATION = [
  "test/copy/bodyComposition.test.ts",
  "test/copy/hermesRuntime.test.ts",
  "test/copy/weight.test.ts",
  "test/dates/formatClockTime.test.ts",
  "test/diary/densityEstimateFreezing.test.ts",
  "test/nutrition/volume.test.ts",
  "test/plans/fitCalls.test.ts",
];

export default defineConfig({
  test: {
    // Locally a run uses half the cores, so several runs at once do not bury the machine. CI keeps the default.
    ...(process.env.CI ? {} : { maxWorkers: "50%" }),
    // A 2-core CI runner under load is several times slower than a laptop, so CI gets three times the default.
    testTimeout: process.env.CI ? 15_000 : 5_000,
    projects: [
      {
        extends: true,
        test: {
          name: "shared",
          include: ["test/**/*.test.ts"],
          exclude: FILES_THAT_NEED_ISOLATION,
          isolate: false,
        },
      },
      {
        extends: true,
        test: {
          name: "isolated",
          include: FILES_THAT_NEED_ISOLATION,
          isolate: true,
        },
      },
    ],
  },
});
