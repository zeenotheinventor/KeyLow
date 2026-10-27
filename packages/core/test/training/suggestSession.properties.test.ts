import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  EQUIPMENT,
  estimateSessionMinutes,
  EXERCISE_MECHANICS,
  MUSCLE_IDS,
  MUSCLE_ROLES,
  SESSION_TIME_PARAMS_V1,
  suggestSession,
  SUGGEST_PARAMS_V2,
} from "../../src/training";

import type {
  Equipment,
  ExerciseMechanic,
  MuscleId,
  MuscleRole,
  SuggestExercise,
  SuggestGoals,
  SuggestState,
} from "../../src/training";

/*
 * Properties of `suggestSession` on random libraries. The pools are small on purpose (three names, a few
 * heat and set values), so equal scores, equal names and hot muscles come up all the time.
 */

type Scenario = {
  library: SuggestExercise[];
  heats: Record<MuscleId, number>;
  sets: Record<MuscleId, number>;
  priorities: Record<MuscleId, number>;
  equipment: Equipment[];
  minutes: number;
  shuffleSeed: number[];
};

const perMuscle = <Value>(value: fc.Arbitrary<Value>): fc.Arbitrary<Record<MuscleId, Value>> =>
  fc
    .tuple(...MUSCLE_IDS.map(() => value))
    .map((values) => recordInOrder(MUSCLE_IDS, (muscle) => values[MUSCLE_IDS.indexOf(muscle)]));

const hasEveryMuscle = <Value>(
  record: Readonly<Record<string, Value | undefined>>,
): record is Record<MuscleId, Value> => MUSCLE_IDS.every((muscle) => record[muscle] !== undefined);

/** A record of every muscle with its keys added in `order`, so key order can be shuffled. */
const recordInOrder = <Value>(
  order: readonly MuscleId[],
  valueOf: (muscle: MuscleId) => Value | undefined,
): Record<MuscleId, Value> => {
  const record = Object.fromEntries(order.map((muscle) => [muscle, valueOf(muscle)]));
  if (!hasEveryMuscle(record)) {
    throw new Error("The order must name every muscle and give each a value");
  }
  return record;
};

const muscleEntries = fc.uniqueArray(
  fc.record({
    muscle_id: fc.constantFrom(...MUSCLE_IDS),
    role: fc.constantFrom<MuscleRole>(...MUSCLE_ROLES),
    weight: fc.constantFrom(0.2, 0.5, 1),
  }),
  { selector: (entry) => entry.muscle_id, minLength: 1, maxLength: 5 },
);

const scenarios: fc.Arbitrary<Scenario> = fc.record({
  library: fc
    .array(
      fc.record({
        name: fc.constantFrom("Alpha", "Bravo", "Charlie"),
        equipment: fc.constantFrom<Equipment>(...EQUIPMENT),
        mechanic: fc.constantFrom<ExerciseMechanic>(...EXERCISE_MECHANICS),
        muscles: muscleEntries,
      }),
      { maxLength: 14 },
    )
    // A primary muscle is required, and ids follow the position so equal names still differ by id.
    .map((exercises) =>
      exercises.map((each, index) => ({
        ...each,
        id: `exercise-${String(index).padStart(2, "0")}`,
        muscles: each.muscles.map((entry, position) =>
          position === 0 ? { ...entry, role: "primary" as const } : entry,
        ),
      })),
    ),
  heats: perMuscle(fc.constantFrom(0, 0.25, 0.5, 0.75)),
  sets: perMuscle(fc.constantFrom(0, 4, 8, 12)),
  priorities: perMuscle(fc.constantFrom(0, 1, 2, 3)),
  equipment: fc.uniqueArray(fc.constantFrom<Equipment>(...EQUIPMENT), {
    minLength: 1,
    maxLength: EQUIPMENT.length,
  }),
  minutes: fc.integer({ min: 5, max: 180 }),
  shuffleSeed: fc.array(fc.nat(1000), { minLength: 60, maxLength: 60 }),
});

/** A permutation of `items` that depends only on `seed`, so a failing case can be replayed. */
const permuted = <Item>(items: readonly Item[], seed: readonly number[], offset: number): Item[] =>
  items
    .map((item, index) => ({
      item,
      key: (seed[(index + offset) % seed.length] ?? 0) * 997 + index,
    }))
    .sort((first, second) => first.key - second.key)
    .map(({ item }) => item);

const stateOf = (scenario: Scenario, order: readonly MuscleId[]): SuggestState =>
  recordInOrder(order, (muscle) => ({
    heat: scenario.heats[muscle],
    weeklySets: scenario.sets[muscle],
  }));

const goalsOf = (scenario: Scenario, order: readonly MuscleId[]): SuggestGoals => ({
  goal: "hybrid",
  experience: "intermediate",
  equipment: scenario.equipment,
  session_minutes: scenario.minutes,
  muscle_priority: recordInOrder(order, (muscle) => scenario.priorities[muscle]),
});

const run = (scenario: Scenario) =>
  suggestSession(
    stateOf(scenario, MUSCLE_IDS),
    goalsOf(scenario, MUSCLE_IDS),
    scenario.library,
    {},
    SUGGEST_PARAMS_V2,
  );

describe("suggestSession properties", () => {
  it("should give the same bytes for a shuffled library, shuffled muscle lists and shuffled state keys", () => {
    fc.assert(
      fc.property(scenarios, (scenario) => {
        const shuffledLibrary = permuted(scenario.library, scenario.shuffleSeed, 0).map(
          (exercise, index) => ({
            ...exercise,
            muscles: permuted(exercise.muscles, scenario.shuffleSeed, index),
          }),
        );
        const shuffled = suggestSession(
          stateOf(scenario, permuted(MUSCLE_IDS, scenario.shuffleSeed, 7)),
          {
            ...goalsOf(scenario, permuted(MUSCLE_IDS, scenario.shuffleSeed, 13)),
            equipment: permuted(scenario.equipment, scenario.shuffleSeed, 3),
          },
          shuffledLibrary,
          {},
          SUGGEST_PARAMS_V2,
        );
        expect(JSON.stringify(shuffled)).toBe(JSON.stringify(run(scenario)));
      }),
    );
  });

  it("should never read longer than the minutes budget", () => {
    fc.assert(
      fc.property(scenarios, (scenario) => {
        const result = run(scenario);
        if (result.kind === "session") {
          expect(result.minutes).toBeLessThanOrEqual(scenario.minutes);
          expect(result.minutes).toBe(
            estimateSessionMinutes(
              { exercises: result.exercises.length, sets: result.sets },
              SESSION_TIME_PARAMS_V1,
            ),
          );
        }
      }),
    );
  });

  it("should only suggest equipment the user has, never the same exercise twice, and never a hot primary muscle", () => {
    fc.assert(
      fc.property(scenarios, (scenario) => {
        const result = run(scenario);
        if (result.kind !== "session") {
          return;
        }
        const ids = result.exercises.map((exercise) => exercise.exercise_id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.length).toBeLessThanOrEqual(SUGGEST_PARAMS_V2.maxExercises.fresh);
        for (const id of ids) {
          const chosen = scenario.library.find((exercise) => exercise.id === id);
          expect(chosen).toBeDefined();
          expect(scenario.equipment).toContain(chosen?.equipment);
          for (const entry of chosen?.muscles ?? []) {
            if (entry.role === "primary") {
              expect(scenario.heats[entry.muscle_id]).toBeLessThanOrEqual(
                SUGGEST_PARAMS_V2.hotHeatThreshold,
              );
            }
          }
        }
      }),
    );
  });

  it("should give every reason a positive score and every skipped muscle a heat above the threshold", () => {
    fc.assert(
      fc.property(scenarios, (scenario) => {
        const result = run(scenario);
        for (const skipped of result.skipped) {
          expect(skipped.heat).toBeGreaterThan(SUGGEST_PARAMS_V2.hotHeatThreshold);
        }
        if (result.kind === "session") {
          for (const exercise of result.exercises) {
            for (const reason of exercise.reasons) {
              expect(reason.score).toBeGreaterThan(0);
            }
          }
        }
      }),
    );
  });
});
