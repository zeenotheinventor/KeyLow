import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { recordOfMuscles } from "./goldenWeekInputs";
import { at, DAY, heatSet, MORNING } from "./heatSets";
import {
  gapValues,
  heatValues,
  MUSCLE_IDS,
  muscleState,
  PLAN_STATUSES,
  TRAINING_PARAMS_V1,
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

describe("the heat step and the ready test", () => {
  // Few muscles share the sets, so some get hot while the rest stay rested.
  const anyLoggedSet = fc.record({
    muscle: fc.constantFrom(...MUSCLE_IDS.slice(0, 2)),
    weight: fc.double({ min: 0.1, max: 1, noNaN: true }),
    daysBefore: fc.oneof(
      fc.double({ min: 0, max: 2, noNaN: true }),
      fc.double({ min: 0, max: 15, noNaN: true }),
    ),
  });
  const anyLoggedSets = fc.array(anyLoggedSet, { minLength: 10, maxLength: 120 });

  it("should give a muscle step 0 or 1 if and only if it is ready, and never step 1 to one that is not", () => {
    fc.assert(
      fc.property(anyLoggedSets, (logged) => {
        const now = at(MORNING);
        const sets = logged.map(({ muscle, weight, daysBefore }) =>
          heatSet([{ muscle_id: muscle, role: "primary", weight }], {
            performed_at: at(MORNING - Math.floor(daysBefore * DAY)),
          }),
        );
        const states = muscleState(sets, now, TRAINING_PARAMS_V1);
        const steps = heatValues(states);

        for (const muscle of MUSCLE_IDS) {
          const ready = states[muscle].readyAt === now;
          expect(steps[muscle] <= 1).toBe(ready);
          if (!ready) {
            expect(steps[muscle]).toBeGreaterThanOrEqual(2);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it("should agree with the ready time where the sets bring fatigue to the threshold", () => {
    const now = at(MORNING);
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 60 }),
        fc.constantFrom(0.1, 0.2, 0.25, 0.3, 0.5, 1),
        (count, weight) => {
          const sets = Array.from({ length: count }, () =>
            heatSet([{ muscle_id: "lats", role: "primary", weight }]),
          );
          const state = muscleState(sets, now, TRAINING_PARAMS_V1).lats;

          expect(
            heatValues({ ...recordOfMuscles(() => ({ heat: 0 })), lats: state }).lats <= 1,
          ).toBe(state.readyAt === now);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("should keep the steps in the order of the heat", () => {
    fc.assert(
      fc.property(anyHeatStates, (states) => {
        const steps = heatValues(states);
        const byHeat = [...MUSCLE_IDS].sort(
          (first, second) => states[first].heat - states[second].heat,
        );

        byHeat.slice(1).forEach((muscle, index) => {
          const cooler = byHeat[index] ?? muscle;
          expect(steps[muscle]).toBeGreaterThanOrEqual(steps[cooler]);
        });
      }),
    );
  });
});
