import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const run = promisify(execFile);
const packageRoot = join(import.meta.dirname, "..");
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");

type Finished = { stdout: string; stderr: string; exitCode: number };

const isFailedRun = (error: unknown): error is { stdout: string; stderr: string; code: number } =>
  typeof error === "object" &&
  error !== null &&
  "stdout" in error &&
  typeof error.stdout === "string" &&
  "stderr" in error &&
  typeof error.stderr === "string" &&
  "code" in error &&
  typeof error.code === "number";

// A child process, because the question is what the command line runner can load, not what Vitest can.
async function tsx(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<Finished> {
  try {
    const { stdout, stderr } = await run(process.execPath, [tsxCli, ...args], {
      cwd: packageRoot,
      env,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    if (isFailedRun(error)) {
      return { stdout: error.stdout, stderr: error.stderr, exitCode: error.code };
    }
    throw error;
  }
}

const withoutKey = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => name !== "ANTHROPIC_API_KEY"),
);

describe("the check:assistant entry", () => {
  it("should be run by tsx, which loads the extensionless and .tsx files of the workspace packages", () => {
    const packageJson: unknown = JSON.parse(
      readFileSync(join(packageRoot, "package.json"), "utf8"),
    );

    expect(packageJson).toMatchObject({ scripts: { "check:assistant": "tsx src/run.ts" } });
  });

  it("should load createFixtureUser through the runner the command uses", async () => {
    const result = await tsx([
      "--eval",
      "import('./src/fixtureUser.ts').then((module) => console.log(typeof module.createFixtureUser))",
    ]);

    expect(result.stdout.trim()).toBe("function");
    expect(result.exitCode).toBe(0);
  }, 30_000);

  it("should print the missing key message and exit 1 when run with no key", async () => {
    const result = await tsx(["src/run.ts"], withoutKey);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("ANTHROPIC_API_KEY is not set");
    expect(result.stderr).not.toMatch(/\bat .*\(|\.ts:\d+/);
  }, 30_000);
});
