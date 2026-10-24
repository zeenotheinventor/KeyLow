import { expect } from "vitest";

import type { ReplayRow } from "../src/replayRow.ts";

/** The row at `index`, or a failure that says which index was missing. */
export function rowAt(rows: readonly ReplayRow[], index: number): ReplayRow {
  const row = rows[index];
  if (row === undefined) {
    throw new Error(`The replay has no row at index ${index}.`);
  }
  return row;
}

export function expectWithin(actual: number, expected: number, tolerance: number): void {
  expect(actual).toBeGreaterThanOrEqual(expected - tolerance);
  expect(actual).toBeLessThanOrEqual(expected + tolerance);
}

/** A valid history as plain data: a 35 year old man born on 1990-04-20, with no weigh-ins and no days. */
export function historyObject(
  changes: Readonly<{
    stats?: Record<string, unknown>;
    program?: Record<string, unknown>;
    weighIns?: readonly unknown[];
    days?: readonly unknown[];
  }> = {},
) {
  return {
    stats: {
      sex: "male",
      birthDate: "1990-04-20",
      heightCm: 180,
      activity: "moderate",
      ...changes.stats,
    },
    onboardingWeightKg: 80,
    program: {
      goal: "lose",
      ratePctPerWeek: 0.5,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
      dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
      startedOn: "2026-04-02",
      ...changes.program,
    },
    weighIns: changes.weighIns ?? [],
    days: changes.days ?? [],
  };
}

/** One entry for each of `count` days from `firstDay` (a day of April 2026), built by `entry`. */
export function aprilDays<Entry>(
  firstDay: number,
  count: number,
  entry: (localDate: string, index: number) => Entry,
): Entry[] {
  return Array.from({ length: count }, (_, index) =>
    entry(`2026-04-${String(firstDay + index).padStart(2, "0")}`, index),
  );
}
