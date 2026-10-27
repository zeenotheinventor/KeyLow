import { readFileSync } from "node:fs";
import path from "node:path";

// Kotlin cannot run under Jest, so this reads the installed source instead. It fails when an
// upgrade of expo-updates, or an install that skipped patches/expo-updates@*.patch, brings back the
// original ErrorRecovery that drops every exception once its ten second window has closed (KEY-734,
// https://github.com/expo/expo/issues/41543).
const repositoryRoot = path.join(__dirname, "..", "..", "..", "..");
const errorRecoveryPath = path.join(
  repositoryRoot,
  "node_modules",
  "expo-updates",
  "android",
  "src",
  "main",
  "java",
  "expo",
  "modules",
  "updates",
  "errorrecovery",
  "ErrorRecovery.kt",
);

// Comment lines are dropped, so the words in the patch's own explanation cannot satisfy a check.
function readOnReactInstanceException() {
  const source = readFileSync(errorRecoveryPath, "utf8");
  const start = source.indexOf("internal fun onReactInstanceException(");
  const end = source.indexOf("fun notifyNewRemoteLoadStatus(");
  return source
    .slice(start, end)
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

describe("expo-updates error recovery patch", () => {
  it("should find the function it checks", () => {
    expect(readOnReactInstanceException()).toContain("exception: Exception");
  });

  it("should keep the recovery pipeline for exceptions while error recovery is armed", () => {
    expect(readOnReactInstanceException()).toMatch(
      /if \(shouldHandleReactInstanceException\) \{\s+handleException\(exception\)\s+return\s+\}/,
    );
  });

  it("should hand exceptions to the default uncaught handler once error recovery is disarmed", () => {
    const afterArmedBranch = readOnReactInstanceException().split("return")[1];

    expect(afterArmedBranch).toContain("Thread.getDefaultUncaughtExceptionHandler()");
    expect(afterArmedBranch).toContain("uncaughtException(Thread.currentThread(), exception)");
  });

  it("should throw the exception when there is no default uncaught handler", () => {
    expect(readOnReactInstanceException()).toMatch(
      /getDefaultUncaughtExceptionHandler\(\)\s*\?: throw exception/,
    );
  });
});
