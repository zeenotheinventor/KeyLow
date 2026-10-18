import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { recordOfMuscles } from "./goldenWeekInputs";
import {
  gapValues,
  heatValues,
  MUSCLE_IDS,
  PLAN_STATUSES,
  volumeValues,
  warmestMuscles,
} from "../../src/training";

import type { MuscleId, MusclePlanComparison } from "../../src/training";

const MUSCLE_COUNT = MUSCLE_IDS.length;
const sortedIds = [...MUSCLE_IDS].sort();

/** The same record with its keys inserted in the order given, which must hold every id. */
const insertedIn = <Value>(
  record: Readonly<Record<MuscleId, Value>>,
  order: readonly MuscleId[],
): Record<MuscleId, Value> =>
  // The order is a permutation of every id, so the entries make the full record.
  Object.fromEntries(order.map((muscle) => [muscle, record[muscle]])) as Record<MuscleId, Value>;

/** A record of every muscle id with a value drawn for each. */
const recordOf = <Value>(
  value: fc.Arbitrary<Value>,
  fallback: Value,
): fc.Arbitrary<Record<MuscleId, Value>> =>
  fc
    .array(value, { minLength: MUSCLE_COUNT, maxLength: MUSCLE_COUNT })
    .map((values) => recordOfMuscles((muscle) => values[MUSCLE_IDS.indexOf(muscle)] ?? fallback));

const anyOrder = fc.shuffledSubarray([...MUSCLE_IDS], {
  minLength: MUSCLE_COUNT,
  maxLength: MUSCLE_COUNT,
});

// Heat runs from 0 to 1, with exact steps and ties often enough to matter.
const anyHeat = fc.oneof(
  fc.double({ min: 0, max: 1, noNaN: true }),
  fc.constantFrom(0, 0.05, 0.2, 0.4, 0.6, 0.8, 1),
);
const anyHeatStates = recordOf(
  anyHeat.map((heat) => ({ heat })),
  { heat: 0 },
);

const anySets = fc.oneof(
  fc.double({ min: 0, max: 40, noNaN: true }),
  fc.constantFrom(0, 6, 10, 22),
);
const anyComparison = recordOf<MusclePlanComparison>(
  fc.record({
    actualWeeklySets: anySets,
    projectedWeeklySets: anySets,
    gap: fc.constant(0),
    status: fc.constantFrom(...PLAN_STATUSES),
  }),
  { actualWeeklySets: 0, projectedWeeklySets: 0, gap: 0, status: "on_plan" },
);
const anyTargeted = fc.subarray([...MUSCLE_IDS]).map((muscles) => new Set<MuscleId>(muscles));

describe("the body map values", () => {
  it("should hold every muscle id in each record, whatever the input", () => {
    fc.assert(
      fc.property(anyHeatStates, anyComparison, anyTargeted, (states, comparison, targeted) => {
        for (const values of [
          heatValues(states),
          volumeValues(comparison, targeted, "actual"),
          volumeValues(comparison, targeted, "projected"),
          gapValues(comparison, targeted),
        ]) {
          expect(Object.keys(values).sort()).toStrictEqual(sortedIds);
        }
      }),
    );
  });

  it("should give the same values however the input record is ordered", () => {
    fc.assert(
      fc.property(
        anyHeatStates,
        anyComparison,
        anyTargeted,
        anyOrder,
        (states, comparison, targeted, order) => {
          const shuffledStates = insertedIn(states, order);
          const shuffledComparison = insertedIn(comparison, order);

          expect(heatValues(shuffledStates)).toStrictEqual(heatValues(states));
          expect(warmestMuscles(shuffledStates)).toStrictEqual(warmestMuscles(states));
          expect(volumeValues(shuffledComparison, targeted, "actual")).toStrictEqual(
            volumeValues(comparison, targeted, "actual"),
          );
          expect(gapValues(shuffledComparison, targeted)).toStrictEqual(
            gapValues(comparison, targeted),
          );
        },
      ),
    );
  });

  it("should give the same values however the targeted set was built", () => {
    fc.assert(
      fc.property(anyComparison, anyTargeted, anyOrder, (comparison, targeted, order) => {
        const rebuilt = new Set(order.filter((muscle) => targeted.has(muscle)));

        expect(gapValues(comparison, rebuilt)).toStrictEqual(gapValues(comparison, targeted));
        expect(volumeValues(comparison, rebuilt, "projected")).toStrictEqual(
          volumeValues(comparison, targeted, "projected"),
        );
      }),
    );
  });

  it("should keep each value within its scale", () => {
    fc.assert(
      fc.property(anyHeatStates, anyComparison, anyTargeted, (states, comparison, targeted) => {
        const within = (values: Record<MuscleId, number>, highest: number): boolean =>
          Object.values(values).every(
            (value) => Number.isInteger(value) && value >= 0 && value <= highest,
          );

        expect(within(heatValues(states), 5)).toBe(true);
        expect(within(volumeValues(comparison, targeted, "actual"), 4)).toBe(true);
        expect(within(gapValues(comparison, targeted), 3)).toBe(true);
      }),
    );
  });

  it("should order the warmest muscles from the warmest down and never name a cold one", () => {
    fc.assert(
      fc.property(anyHeatStates, fc.integer({ min: 0, max: 25 }), (states, count) => {
        const warmest = warmestMuscles(states, count);

        expect(warmest.length).toBeLessThanOrEqual(count);
        for (const { muscle } of warmest) {
          expect(states[muscle].heat).toBeGreaterThan(0);
        }
        warmest.slice(1).forEach(({ muscle }, index) => {
          const before = warmest[index]?.muscle ?? muscle;
          expect(states[before].heat).toBeGreaterThanOrEqual(states[muscle].heat);
        });
      }),
    );
  });
});
