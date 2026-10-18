import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseChecksumFile, sha256Hex } from "../../../scripts/cofid/checksum";
import { parseCsv } from "../../../scripts/cofid/csv";
import { checkCurated } from "../../../scripts/exercises/checkCurated";
import { curateExercises } from "../../../scripts/exercises/curate";
import { EXERCISE_FILES } from "../../../scripts/exercises/files";
import { isMuscleId } from "../../../scripts/exercises/muscles";
import { formatMuscleShares } from "../../../scripts/exercises/muscleShares";

const readPackageFile = (path: string): Buffer =>
  readFileSync(new URL(`../../../${path}`, import.meta.url));

const source = readPackageFile(EXERCISE_FILES.source);
const overrides = readPackageFile(EXERCISE_FILES.overrides).toString("utf8");
const committedCurated = readPackageFile(EXERCISE_FILES.curated).toString("utf8");
const committedExcluded = readPackageFile(EXERCISE_FILES.excluded).toString("utf8");

/**
 * The rows of REVIEW-SAMPLE.md's tables, as source_ref to muscles string. A row is
 * `| name | ref in backticks | primary | secondary | stabiliser | ...`, each role cell a list of
 * `muscle weight` pairs or `none`.
 */
function readReviewSample(markdown: string): Map<string, string> {
  const rows = new Map<string, string>();
  for (const line of markdown.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    const refIndex = cells.findIndex((cell) => /^`[^`]+`$/.test(cell) && cell !== "`source_ref`");
    if (refIndex === -1) {
      continue;
    }
    const shares = (["primary", "secondary", "stabiliser"] as const).flatMap((role, offset) => {
      const cell = cells[refIndex + 1 + offset] ?? "";
      return cell === "none"
        ? []
        : cell.split(", ").map((pair) => {
            const [muscle = "", weight = ""] = pair.split(" ");
            if (!isMuscleId(muscle)) {
              throw new Error("REVIEW-SAMPLE.md names a muscle that is not on the list");
            }
            return { muscle, role, weight: Number(weight) };
          });
    });
    rows.set(cells[refIndex]?.slice(1, -1) ?? "", formatMuscleShares(shares));
  }
  return rows;
}

const reviewSample = readReviewSample(
  readPackageFile("data/exercises/REVIEW-SAMPLE.md").toString("utf8"),
);

const musclesBySourceRef = new Map(
  parseCsv(committedCurated).map(([sourceRef = "", , , , muscles = ""]) => [sourceRef, muscles]),
);

describe("the committed exercise library", () => {
  it("should be built from the pinned free-exercise-db file, whose sha256 VERIFICATION.md records", () => {
    const sha256 = sha256Hex(source);

    expect(sha256).toBe(
      parseChecksumFile(readPackageFile(`${EXERCISE_FILES.source}.sha256`).toString("utf8")),
    );
    expect(readPackageFile("data/exercises/VERIFICATION.md").toString("utf8")).toContain(sha256);
  });

  it("should be exactly what the source and overrides give, so a hand edit of a generated file fails", () => {
    const result = curateExercises(source.toString("utf8"), overrides);

    // Compared as booleans so a mismatch does not print two large strings.
    const message = "run pnpm --filter @keylow/db curate:exercises and commit the result";
    expect(result.curatedCsv === committedCurated, message).toBe(true);
    expect(result.excludedCsv === committedExcluded, message).toBe(true);
  });

  it("should pass the checker", () => {
    expect(checkCurated(committedCurated)).toEqual([]);
  });

  it("should have at least three primary exercises for each muscle the source maps coarsely", () => {
    const { primaryCounts } = curateExercises(source.toString("utf8"), overrides);

    for (const muscle of ["delt_side", "delt_rear", "chest_upper", "glute_med", "neck"] as const) {
      expect(primaryCounts[muscle], muscle).toBeGreaterThanOrEqual(3);
    }
    // The source has one dorsiflexion exercise and nothing else that trains the tibialis (MAPPING.md, "Gaps").
    expect(primaryCounts.tibialis).toBe(1);
  });

  it.each([
    [
      "Barbell_Bench_Press_-_Medium_Grip",
      "chest_lower:primary:1.0;chest_upper:secondary:0.6;delt_front:secondary:0.5;triceps:secondary:0.5",
    ],
    [
      "Standing_Military_Press",
      "delt_front:primary:1.0;delt_side:secondary:0.5;triceps:secondary:0.5",
    ],
    ["Side_Lateral_Raise", "delt_side:primary:1.0"],
    ["Face_Pull", "delt_rear:primary:1.0;traps_mid:secondary:0.5"],
    ["Pullups", "lats:primary:1.0;traps_mid:secondary:0.5;biceps:secondary:0.5"],
    [
      "Bent_Over_Barbell_Row",
      "lats:primary:1.0;traps_mid:primary:1.0;delt_rear:secondary:0.5;biceps:secondary:0.5",
    ],
    [
      "Barbell_Squat",
      "quads:primary:1.0;glute_max:secondary:0.5;hamstrings:secondary:0.5;lower_back:stabiliser:0.2;calves:stabiliser:0.2",
    ],
    [
      "Romanian_Deadlift",
      "hamstrings:primary:1.0;lower_back:secondary:0.5;glute_max:secondary:0.5;calves:stabiliser:0.2",
    ],
    ["Barbell_Hip_Thrust", "glute_max:primary:1.0;hamstrings:secondary:0.5;calves:stabiliser:0.2"],
    ["Standing_Calf_Raises", "calves:primary:1.0"],
  ])("should map %s by the rules, and REVIEW-SAMPLE.md should show it", (sourceRef, muscles) => {
    expect(musclesBySourceRef.get(sourceRef)).toBe(muscles);
    expect(reviewSample.has(sourceRef)).toBe(true);
  });

  it("should show every review sample row exactly as the curated CSV maps it", () => {
    expect(reviewSample.size).toBeGreaterThanOrEqual(40);
    for (const [sourceRef, muscles] of reviewSample) {
      expect(muscles, sourceRef).toBe(musclesBySourceRef.get(sourceRef));
    }
  });
});
