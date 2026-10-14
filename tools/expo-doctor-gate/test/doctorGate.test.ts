import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { classifyDoctorRun, decideGateOutcome } from "../src/doctorGate.ts";

import type { DoctorVerdict } from "../src/doctorGate.ts";

const readFixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}.txt`, import.meta.url), "utf8");

const classifyFailedRun = (output: string): DoctorVerdict =>
  classifyDoctorRun({ exitCode: 1, output });

const failureReason = (verdict: DoctorVerdict): string =>
  verdict.kind === "fail" ? verdict.reason : `not a failure: ${verdict.kind}`;

describe("classifyDoctorRun", () => {
  it("should pass when doctor exits 0", () => {
    expect(classifyDoctorRun({ exitCode: 0, output: readFixture("pass") })).toEqual({
      kind: "pass",
    });
  });

  it("should warn when the only failure is a patch version mismatch", () => {
    expect(classifyFailedRun(readFixture("patch-only"))).toEqual({
      kind: "warn",
      patchMismatches: [{ name: "expo-haptics", expected: "~57.0.3", found: "57.0.2" }],
    });
  });

  it("should warn on a patch-only mismatch when the output carries colour codes", () => {
    expect(classifyFailedRun(readFixture("patch-only-colored"))).toEqual({
      kind: "warn",
      patchMismatches: [{ name: "expo-haptics", expected: "~57.0.3", found: "57.0.2" }],
    });
  });

  it("should list every package when several are a patch behind", () => {
    const output = [
      "Running 21 checks on your project...",
      "20/21 checks passed. 1 checks failed. Possible issues detected:",
      "Use the --verbose flag to see more details about passed checks.",
      "",
      "✖ Check that packages match versions required by installed Expo SDK",
      "",
      "🔧 Patch version mismatches",
      "package              expected  found   ",
      "expo                 ~57.0.29  57.0.28  ",
      "expo-constants       ~57.0.22  57.0.21  ",
      "@expo/metro-runtime  ^57.0.17  57.0.16  ",
      "",
      "3 packages out of date.",
      "",
      "1 check failed, indicating possible issues with the project.",
    ].join("\n");

    expect(classifyFailedRun(output)).toEqual({
      kind: "warn",
      patchMismatches: [
        { name: "expo", expected: "~57.0.29", found: "57.0.28" },
        { name: "expo-constants", expected: "~57.0.22", found: "57.0.21" },
        { name: "@expo/metro-runtime", expected: "^57.0.17", found: "57.0.16" },
      ],
    });
  });

  it("should fail when a minor version mismatch sits beside a patch one", () => {
    expect(failureReason(classifyFailedRun(readFixture("patch-and-minor")))).toContain("Minor");
  });

  it("should fail when a major version mismatch is present", () => {
    expect(failureReason(classifyFailedRun(readFixture("patch-minor-major")))).toContain("Major");
  });

  it("should fail on an Other/prerelease mismatch", () => {
    const output = readFixture("patch-only").replace(
      "🔧 Patch version mismatches",
      "➿ Other/prerelease mismatches",
    );

    expect(failureReason(classifyFailedRun(output))).toContain("Other/prerelease");
  });

  it("should fail when a non-version check fails and nothing else does", () => {
    expect(failureReason(classifyFailedRun(readFixture("other-failure-only")))).toContain(
      "Check for issues with Metro config",
    );
  });

  it("should fail when a non-version check fails beside a patch mismatch", () => {
    expect(failureReason(classifyFailedRun(readFixture("patch-and-other-failure")))).toContain(
      "Check for issues with Metro config",
    );
  });

  it("should fail when doctor did not exit normally", () => {
    expect(classifyDoctorRun({ exitCode: null, output: "" }).kind).toBe("fail");
  });

  it("should fail when a failing run has no summary line to read", () => {
    expect(failureReason(classifyFailedRun("Error: connect ECONNRESET"))).toContain(
      "without a summary line",
    );
  });

  it("should fail when the failed check count disagrees with the failed checks listed", () => {
    const output = readFixture("patch-only").replace("1 checks failed", "2 checks failed");

    expect(failureReason(classifyFailedRun(output))).toContain("2 failed checks but 1");
  });

  it("should fail when the version check lists no section", () => {
    const output = readFixture("patch-only")
      .replace(/🔧[\s\S]*?\n\n/, "")
      .replace("1 package out of date.", "");

    expect(failureReason(classifyFailedRun(output))).toContain("single patch mismatches section");
  });

  it("should fail when a row cannot be read as a package and two versions", () => {
    const output = readFixture("patch-only").replace(
      "expo-haptics  ~57.0.3   57.0.2",
      "expo-haptics  ~57.0.3   canary",
    );

    expect(failureReason(classifyFailedRun(output))).toContain("Could not read");
  });

  it("should fail when a row filed under patch actually differs by minor version", () => {
    const output = readFixture("patch-only").replace("57.0.2", "57.1.2");

    expect(failureReason(classifyFailedRun(output))).toContain("Could not read");
  });

  it("should fail when a line it does not recognise sits between the failed check and the patch section", () => {
    const output = readFixture("patch-only").replace(
      "\n\n🔧 Patch version mismatches",
      "\n- some new advice line\n\n🔧 Patch version mismatches",
    );

    expect(failureReason(classifyFailedRun(output))).toContain("some new advice line");
  });

  it("should fail when the found version is newer than the expected one", () => {
    const output = readFixture("patch-only").replace("57.0.2", "57.0.4");

    expect(failureReason(classifyFailedRun(output))).toContain("Could not read");
  });

  it("should fail when the patch table runs to the end of the output", () => {
    const output = [
      "20/21 checks passed. 1 checks failed. Possible issues detected:",
      "",
      "✖ Check that packages match versions required by installed Expo SDK",
      "",
      "🔧 Patch version mismatches",
      "package       expected  found",
      "expo-haptics  ~57.0.3   57.0.2",
    ].join("\n");

    expect(failureReason(classifyFailedRun(output))).toContain("blank line");
  });

  it("should fail when the out-of-date count disagrees with the rows read", () => {
    const output = readFixture("patch-only").replace(
      "1 package out of date.",
      "2 packages out of date.",
    );

    expect(failureReason(classifyFailedRun(output))).toContain("out-of-date count");
  });
});

describe("decideGateOutcome", () => {
  it("should exit 0 with no annotation when the verdict is pass", () => {
    expect(decideGateOutcome({ kind: "pass" })).toEqual({ exitCode: 0, annotations: [] });
  });

  it("should exit 0 with a warning annotation naming each package when the verdict is warn", () => {
    const outcome = decideGateOutcome({
      kind: "warn",
      patchMismatches: [
        { name: "expo", expected: "~57.0.29", found: "57.0.28" },
        { name: "expo-router", expected: "~57.0.27", found: "57.0.26" },
      ],
    });

    expect(outcome).toEqual({
      exitCode: 0,
      annotations: [
        "::warning title=Expo patch versions behind::expo (found 57.0.28, expected ~57.0.29), expo-router (found 57.0.26, expected ~57.0.27). Patch releases are installed in a batch when a native build is made, so this does not fail CI.",
      ],
    });
  });

  it("should exit 1 with an error annotation when the verdict is fail", () => {
    expect(decideGateOutcome({ kind: "fail", reason: "Minor version mismatches present" })).toEqual(
      {
        exitCode: 1,
        annotations: ["::error title=Expo project health::Minor version mismatches present"],
      },
    );
  });
});
