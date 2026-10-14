import { stripVTControlCharacters } from "node:util";

export type DoctorRun = {
  exitCode: number | null;
  output: string;
};

export type PackageMismatch = {
  name: string;
  expected: string;
  found: string;
};

export type DoctorVerdict =
  | { kind: "pass" }
  | { kind: "warn"; patchMismatches: PackageMismatch[] }
  | { kind: "fail"; reason: string };

export type GateOutcome = {
  exitCode: 0 | 1;
  annotations: string[];
};

const VERSION_CHECK_TITLE = "Check that packages match versions required by installed Expo SDK";

const SECTION_TITLES = [
  "Major version mismatches",
  "Minor version mismatches",
  "Patch version mismatches",
  "Other/prerelease mismatches",
] as const;

const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const EXPECTED_VERSION_PATTERN = /^[~^]?(\d+)\.(\d+)\.(\d+)$/;
const FOUND_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

const fail = (reason: string): DoctorVerdict => ({ kind: "fail", reason });

const readSectionTitle = (line: string): (typeof SECTION_TITLES)[number] | undefined =>
  SECTION_TITLES.find((title) => line.endsWith(title));

const readPatchRow = (line: string): PackageMismatch | undefined => {
  const [name, expected, found, ...rest] = line.trim().split(/\s+/);
  if (name === undefined || expected === undefined || found === undefined || rest.length > 0) {
    return undefined;
  }
  const expectedParts = EXPECTED_VERSION_PATTERN.exec(expected);
  const foundParts = FOUND_VERSION_PATTERN.exec(found);
  if (!PACKAGE_NAME_PATTERN.test(name) || expectedParts === null || foundParts === null) {
    return undefined;
  }
  const isPatchOnly =
    expectedParts[1] === foundParts[1] &&
    expectedParts[2] === foundParts[2] &&
    Number(foundParts[3]) < Number(expectedParts[3]);
  return isPatchOnly ? { name, expected, found } : undefined;
};

// Doctor has no switch for "warn on patch versions only", so its report is read here. Anything this
// cannot positively recognise as a patch-only version mismatch is a failure, never a pass.
export const classifyDoctorRun = ({ exitCode, output }: DoctorRun): DoctorVerdict => {
  if (exitCode === 0) {
    return { kind: "pass" };
  }
  if (exitCode === null) {
    return fail("expo-doctor did not exit normally.");
  }

  const lines = stripVTControlCharacters(output).split("\n");

  const summary = lines
    .map((line) => /^\d+\/\d+ checks? passed\. (\d+) checks? failed/.exec(line))
    .find((match) => match !== null);
  if (summary === undefined) {
    return fail(`expo-doctor exited ${exitCode} without a summary line to read.`);
  }
  const failedCheckCount = Number(summary[1]);

  const failedChecks = lines.flatMap((line, index) =>
    line.startsWith("✖ ") ? [{ title: line.slice(2).trim(), index }] : [],
  );
  if (failedChecks.length !== failedCheckCount) {
    return fail(
      `expo-doctor reported ${failedCheckCount} failed checks but ${failedChecks.length} were listed.`,
    );
  }
  const otherFailedChecks = failedChecks.filter(({ title }) => title !== VERSION_CHECK_TITLE);
  if (otherFailedChecks.length > 0) {
    return fail(
      `expo-doctor failed checks other than the version check: ${otherFailedChecks
        .map(({ title }) => title)
        .join("; ")}`,
    );
  }
  const [versionCheck] = failedChecks;
  if (versionCheck === undefined || failedChecks.length !== 1) {
    return fail("expo-doctor failed without listing the version check exactly once.");
  }

  const reportLines = lines.slice(versionCheck.index + 1);
  const sections = reportLines.flatMap((line, index) => {
    const title = readSectionTitle(line);
    return title === undefined ? [] : [{ title, index }];
  });
  const nonPatchSections = sections.filter(({ title }) => title !== "Patch version mismatches");
  if (nonPatchSections.length > 0) {
    return fail(
      `The Expo version check lists more than patch mismatches: ${nonPatchSections
        .map(({ title }) => title)
        .join(", ")}.`,
    );
  }
  const [patchSection] = sections;
  if (patchSection === undefined || sections.length !== 1) {
    return fail("The Expo version check does not list a single patch mismatches section.");
  }

  const unrecognisedLine = reportLines
    .slice(0, patchSection.index)
    .find((line) => line.trim() !== "");
  if (unrecognisedLine !== undefined) {
    return fail(
      `The Expo version check has an unrecognised line before its patch section: "${unrecognisedLine.trim()}".`,
    );
  }

  const [tableHeader, ...afterHeader] = reportLines.slice(patchSection.index + 1);
  if (tableHeader?.trim().split(/\s+/).join(" ") !== "package expected found") {
    return fail("The patch mismatches table has no package, expected and found header.");
  }
  const tableEnd = afterHeader.findIndex((line) => line.trim() === "");
  if (tableEnd === -1) {
    return fail("The patch mismatches table is not followed by a blank line.");
  }
  const rowLines = afterHeader.slice(0, tableEnd);
  const patchMismatches: PackageMismatch[] = [];
  for (const rowLine of rowLines) {
    const row = readPatchRow(rowLine);
    if (row === undefined) {
      return fail(`Could not read "${rowLine.trim()}" as a patch version mismatch.`);
    }
    patchMismatches.push(row);
  }
  if (patchMismatches.length === 0) {
    return fail("The patch mismatches table has no rows.");
  }

  const outOfDateCount = reportLines
    .map((line) => /^(\d+) packages? out of date\.$/.exec(line.trim()))
    .find((match) => match !== null);
  if (outOfDateCount === undefined || Number(outOfDateCount[1]) !== patchMismatches.length) {
    return fail(
      `expo-doctor's out-of-date count does not match the ${patchMismatches.length} patch rows read.`,
    );
  }

  return { kind: "warn", patchMismatches };
};

export const decideGateOutcome = (verdict: DoctorVerdict): GateOutcome => {
  switch (verdict.kind) {
    case "pass":
      return { exitCode: 0, annotations: [] };
    case "warn": {
      const packages = verdict.patchMismatches
        .map(({ name, expected, found }) => `${name} (found ${found}, expected ${expected})`)
        .join(", ");
      return {
        exitCode: 0,
        annotations: [
          `::warning title=Expo patch versions behind::${packages}. Patch releases are installed in a batch when a native build is made, so this does not fail CI.`,
        ],
      };
    }
    case "fail":
      return {
        exitCode: 1,
        annotations: [`::error title=Expo project health::${verdict.reason}`],
      };
  }
};
