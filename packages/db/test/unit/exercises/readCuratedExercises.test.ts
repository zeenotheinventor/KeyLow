import { describe, expect, it } from "vitest";

import { formatCsv } from "../../../scripts/cofid/csv";
import { CURATED_COLUMNS } from "../../../scripts/exercises/columns";
import { MUSCLE_IDS } from "../../../scripts/exercises/muscles";
import { readCuratedExercises } from "../../../scripts/exercises/readCuratedExercises";

type Row = [string, string, string, string, string, string];

// One exercise per muscle id with that muscle as primary: the smallest file that passes every rule.
const validRows = (): Row[] =>
  MUSCLE_IDS.map((muscle) => [
    `Exercise_${muscle}`,
    `Exercise ${muscle}`,
    "barbell",
    "isolation",
    `${muscle}:primary:1.0`,
    "",
  ]);

const fileOf = (rows: readonly Row[]): string => formatCsv([[...CURATED_COLUMNS], ...rows]);

describe("readCuratedExercises", () => {
  it("should read each row as an exercise with its muscle map in the import's field names", () => {
    const rows = validRows();
    rows[0] = [
      "Barbell_Bench_Press",
      "Barbell Bench Press",
      "barbell",
      "compound",
      "chest_upper:primary:1.0;triceps:secondary:0.5;delt_front:stabiliser:0.2",
      "a note",
    ];

    const [first] = readCuratedExercises(fileOf(rows));

    expect(first).toEqual({
      sourceRef: "Barbell_Bench_Press",
      name: "Barbell Bench Press",
      equipment: "barbell",
      mechanic: "compound",
      muscles: [
        { muscleId: "chest_upper", role: "primary", weight: 1 },
        { muscleId: "triceps", role: "secondary", weight: 0.5 },
        { muscleId: "delt_front", role: "stabiliser", weight: 0.2 },
      ],
    });
  });

  it("should read every row of a valid file, in file order", () => {
    const exercises = readCuratedExercises(fileOf(validRows()));

    expect(exercises.map(({ sourceRef }) => sourceRef)).toEqual(
      MUSCLE_IDS.map((muscle) => `Exercise_${muscle}`),
    );
  });

  it("should refuse a file that fails the checker, naming the rules and lines but no value", () => {
    const rows = validRows();
    rows[1] = ["Secret_Lift_Name", "Secret Lift Name", "barbell", "isolation", "abs:primary:7", ""];
    rows[2] = ["Other_Lift", "Other Lift", "barbell", "isolation", "abs:secondary:0.5", ""];

    let message = "";
    try {
      readCuratedExercises(fileOf(rows));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    // Replacing two rows also leaves two muscles that no exercise trains as primary.
    expect(message).toContain("fails 4 checks");
    expect(message).toContain("line 3: weight_out_of_range");
    expect(message).toContain("line 4: no_primary");
    expect(message).toContain("the file: muscle_never_primary");
    expect(message).not.toMatch(/Secret|Other_Lift|abs|7/);
  });
});
