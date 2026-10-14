import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { allowlist } from "./allowlist";
import { applyAllowlist } from "./applyAllowlist";
import { checkSource } from "./checkSource";
import { collectSourceFiles } from "./collectSourceFiles";
import { readCoreHelperNames } from "./coreHelperNames";

import type { Violation } from "./types";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const coreHelperNames = readCoreHelperNames(root);
const files = collectSourceFiles(root);

const describeViolation = ({ path, line, rule, message }: Violation): string =>
  `${path}:${line.toString()} [${rule}] ${message}`;

describe("the repository's source", () => {
  it("should find core's helper names, so the local copy rule has something to check", () => {
    expect([...coreHelperNames]).toEqual(
      expect.arrayContaining(["formatGrams", "describeEnergy", "describeFoodSource", "isFoodId"]),
    );
  });

  it("should find the apps' and packages' source files", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "apps/web/app/layout.tsx",
        "apps/mobile/app/_layout.tsx",
        "packages/tokens/src/preset.ts",
      ]),
    );
  });

  it("should keep one visual language: no rule of the guard is broken outside the allowlist", () => {
    const violations = files.flatMap((path) =>
      checkSource({ path, source: readFileSync(`${root}${path}`, "utf8"), coreHelperNames }),
    );
    const { remaining, unusedEntries } = applyAllowlist(violations, allowlist);

    expect(remaining.map(describeViolation)).toEqual([]);
    expect(unusedEntries.map((entry) => `${entry.rule} ${entry.path}`)).toEqual([]);
  });
});
