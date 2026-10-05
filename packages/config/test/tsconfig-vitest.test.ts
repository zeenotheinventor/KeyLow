import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const vitestEntryPoint = join(
  dirname(createRequire(import.meta.url).resolve("vitest/package.json")),
  "vitest.mjs",
);

const runVitestOverFixture = async (fixtureName: string) => {
  const fixtureDirectory = fileURLToPath(new URL(`./fixtures/${fixtureName}/`, import.meta.url));
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [vitestEntryPoint, "run", "--root", fixtureDirectory],
      { cwd: fixtureDirectory, timeout: 45_000 },
    );
    return { exitCode: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    if (error instanceof Error && "code" in error && "stdout" in error && "stderr" in error) {
      return { exitCode: error.code, output: `${String(error.stdout)}${String(error.stderr)}` };
    }
    throw error;
  }
};

describe("a vitest project extending @keylow/config/tsconfig/react.json by package specifier", () => {
  it("loads the tsconfig and runs its tests", async () => {
    const { exitCode, output } = await runVitestOverFixture("vitest-specifier");
    expect(output).not.toContain("TSCONFIG_ERROR");
    expect(exitCode).toBe(0);
  });
});
