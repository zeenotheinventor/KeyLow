// Checks the curated exercise CSV against the rules the import relies on. Pure: it takes the file's
// text and returns every problem it finds, so a test can feed it a broken file and the generator can
// refuse to write one.
import { CURATED_COLUMNS, EQUIPMENT, MECHANICS } from "./columns";
import { MUSCLE_IDS, isMuscleId, isRole } from "./muscles";
import { parseMuscleShares } from "./muscleShares";
import { parseCsv } from "../cofid/csv";

export type CheckRule =
  | "malformed"
  | "unknown_muscle"
  | "no_primary"
  | "weight_out_of_range"
  | "duplicate_source_ref"
  | "muscle_never_primary";

export interface CheckProblem {
  rule: CheckRule;
  /** The 1-based line of the CSV, absent for a problem with the file as a whole. */
  line?: number;
  sourceRef?: string;
  message: string;
}

const weightPattern = /^\d+(\.\d+)?$/;
const mechanics: ReadonlySet<string> = new Set(MECHANICS);
const equipmentValues: ReadonlySet<string> = new Set(EQUIPMENT);

export function checkCurated(csv: string): CheckProblem[] {
  const problems: CheckProblem[] = [];
  let rows: string[][];
  try {
    rows = parseCsv(csv);
  } catch (error) {
    return [{ rule: "malformed", message: error instanceof Error ? error.message : String(error) }];
  }

  const [header, ...dataRows] = rows;
  if (header?.join(",") !== CURATED_COLUMNS.join(",")) {
    return [
      { rule: "malformed", line: 1, message: `The header is not ${CURATED_COLUMNS.join(",")}` },
    ];
  }

  const linesBySourceRef = new Map<string, number>();
  const primaryMuscles = new Set<string>();

  dataRows.forEach((row, index) => {
    const line = index + 2;
    const report = (rule: CheckRule, message: string, sourceRef?: string): void => {
      problems.push({ rule, line, ...(sourceRef === undefined ? {} : { sourceRef }), message });
    };

    if (row.length !== CURATED_COLUMNS.length) {
      report("malformed", `Expected ${CURATED_COLUMNS.length} fields, found ${row.length}`);
      return;
    }
    const [sourceRef = "", name = "", equipment = "", mechanic = "", musclesText = ""] = row;

    if (sourceRef === "" || name === "") {
      report("malformed", "source_ref and name must not be empty", sourceRef);
    }
    const firstLine = linesBySourceRef.get(sourceRef);
    if (firstLine === undefined) {
      linesBySourceRef.set(sourceRef, line);
    } else {
      report("duplicate_source_ref", `${sourceRef} is already on line ${firstLine}`, sourceRef);
    }
    if (!equipmentValues.has(equipment)) {
      report(
        "malformed",
        `equipment "${equipment}" is not one of ${EQUIPMENT.join(", ")}`,
        sourceRef,
      );
    }
    if (!mechanics.has(mechanic)) {
      report("malformed", `mechanic "${mechanic}" is not ${MECHANICS.join(" or ")}`, sourceRef);
    }

    let shares;
    try {
      shares = parseMuscleShares(musclesText);
    } catch (error) {
      report("malformed", error instanceof Error ? error.message : String(error), sourceRef);
      return;
    }

    const seen = new Set<string>();
    let hasPrimary = false;
    for (const { muscle, role, weight } of shares) {
      if (!isMuscleId(muscle)) {
        report("unknown_muscle", `"${muscle}" is not one of the 22 muscle ids`, sourceRef);
      }
      if (seen.has(muscle)) {
        report("malformed", `${muscle} appears more than once`, sourceRef);
      }
      seen.add(muscle);
      if (!isRole(role)) {
        report("malformed", `${muscle} has role "${role}"`, sourceRef);
      }
      const value = Number(weight);
      if (!weightPattern.test(weight) || value > 1) {
        report(
          "weight_out_of_range",
          `${muscle} has weight "${weight}", which is not a number from 0 to 1`,
          sourceRef,
        );
      }
      if (role === "primary") {
        hasPrimary = true;
        primaryMuscles.add(muscle);
      }
    }
    if (!hasPrimary) {
      report("no_primary", "No muscle has the primary role", sourceRef);
    }
  });

  for (const muscle of MUSCLE_IDS) {
    if (!primaryMuscles.has(muscle)) {
      problems.push({
        rule: "muscle_never_primary",
        message: `${muscle} is not the primary muscle of any exercise`,
      });
    }
  }
  return problems;
}
