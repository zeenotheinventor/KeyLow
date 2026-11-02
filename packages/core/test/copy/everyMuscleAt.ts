import { MUSCLE_IDS } from "../../src/training";

import type { MuscleId } from "../../src/training";

type MuscleValues = Record<MuscleId, number>;

const hasEveryMuscle = (values: Partial<MuscleValues>): values is MuscleValues =>
  MUSCLE_IDS.every((muscle) => values[muscle] !== undefined);

/** A value for every muscle: `fallback`, except where `overrides` gives one. */
export function everyMuscleAt(
  fallback: number,
  overrides: Partial<MuscleValues> = {},
): MuscleValues {
  const values: Partial<MuscleValues> = {};
  for (const muscle of MUSCLE_IDS) {
    values[muscle] = overrides[muscle] ?? fallback;
  }
  if (!hasEveryMuscle(values)) {
    throw new Error("Every muscle must have a value");
  }
  return values;
}
