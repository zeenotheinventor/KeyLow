import { formatCsv } from "../../scripts/cofid/csv";
import { CURATED_COLUMNS } from "../../scripts/exercises/columns";
import { MUSCLE_IDS } from "../../scripts/exercises/muscles";

import type { Json } from "../../src/types.gen";

/** One row of a test library. `muscles` is the CSV text, entries of id:role:weight joined by semicolons. */
export type TestLift = { sourceRef: string; name: string; muscles: string };

/**
 * A lift for each of the 22 muscles with that muscle as its only (primary) muscle. The checker
 * demands that every muscle is primary somewhere, so this is the smallest library it accepts.
 */
export const liftPerMuscle = (prefix: string): TestLift[] =>
  MUSCLE_IDS.map((muscle) => ({
    sourceRef: `${prefix}-${muscle}`,
    name: `${prefix} ${muscle}`,
    muscles: `${muscle}:primary:1.0`,
  }));

export const csvOfLifts = (lifts: readonly TestLift[]): string =>
  formatCsv([
    [...CURATED_COLUMNS],
    ...lifts.map(({ sourceRef, name, muscles }) => [
      sourceRef,
      name,
      "barbell",
      "compound",
      muscles,
      "",
    ]),
  ]);

/** What the source file holds for these lifts, which is all the import needs of it. */
export const sourceRowsOf = (lifts: readonly TestLift[]): Map<string, Json> =>
  new Map(lifts.map(({ sourceRef, name }) => [sourceRef, { id: sourceRef, name }]));
