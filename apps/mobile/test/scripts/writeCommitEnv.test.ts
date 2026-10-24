import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const scriptPath = path.join(__dirname, "..", "..", "scripts", "writeCommitEnv.js");
const fullCommit = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

// A bare environment, so a value set on the machine running the tests cannot leak into the script.
function runInAppDirectory(appDirectory: string, environment: Record<string, string>) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: appDirectory,
    env: { NODE_ENV: "test", PATH: path.dirname(process.execPath), ...environment },
    encoding: "utf8",
  });
}

describe("writeCommitEnv", () => {
  let appDirectory: string;

  beforeEach(() => {
    appDirectory = mkdtempSync(path.join(tmpdir(), "keylow-write-commit-env-"));
  });

  afterEach(() => {
    rmSync(appDirectory, { recursive: true, force: true });
  });

  it("should write the commit of the build to .env.local", () => {
    expect(runInAppDirectory(appDirectory, { EAS_BUILD_GIT_COMMIT_HASH: fullCommit }).status).toBe(
      0,
    );

    expect(readFileSync(path.join(appDirectory, ".env.local"), "utf8")).toBe(
      `EXPO_PUBLIC_COMMIT_SHA=${fullCommit}\n`,
    );
  });

  it("should write nothing and succeed when the variable is absent", () => {
    expect(runInAppDirectory(appDirectory, {}).status).toBe(0);

    expect(existsSync(path.join(appDirectory, ".env.local"))).toBe(false);
  });

  it.each([
    ["empty", ""],
    ["not hex", "not-a-sha"],
    ["longer than forty characters", `${fullCommit}0`],
    ["more than one line", `${fullCommit}\nEXPO_PUBLIC_SUPABASE_URL=https://example.test`],
  ])("should write nothing and succeed when the commit is %s", (_case, commit) => {
    expect(runInAppDirectory(appDirectory, { EAS_BUILD_GIT_COMMIT_HASH: commit }).status).toBe(0);

    expect(existsSync(path.join(appDirectory, ".env.local"))).toBe(false);
  });

  it("should say on its output that it wrote the file", () => {
    const result = runInAppDirectory(appDirectory, { EAS_BUILD_GIT_COMMIT_HASH: fullCommit });

    expect(result.stdout).toContain("wrote EXPO_PUBLIC_COMMIT_SHA to .env.local");
  });

  it("should warn with the error code and still succeed when the directory cannot be written", () => {
    chmodSync(appDirectory, 0o555);

    const result = runInAppDirectory(appDirectory, { EAS_BUILD_GIT_COMMIT_HASH: fullCommit });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("(EACCES)");
    expect(existsSync(path.join(appDirectory, ".env.local"))).toBe(false);
  });

  it("should leave an existing .env.local as it is", () => {
    const envFile = path.join(appDirectory, ".env.local");
    writeFileSync(envFile, "SOMETHING_ELSE=1\n");

    expect(runInAppDirectory(appDirectory, { EAS_BUILD_GIT_COMMIT_HASH: fullCommit }).status).toBe(
      0,
    );

    expect(readFileSync(envFile, "utf8")).toBe("SOMETHING_ELSE=1\n");
  });
});
