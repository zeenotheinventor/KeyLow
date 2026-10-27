import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { PLANNED_DAY_ID, planExerciseOf } from "./suggestPlanInputs";
import {
  EQUIPMENT,
  EXERCISE_MECHANICS,
  estimateSessionMinutes,
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
  PlanRoutineDay,
  SuggestExercise,
  SuggestGoals,
  SuggestState,
} from "../../src/training";

/*
 * Properties of `suggestSession` on a planned day, on random libraries and random planned days. The pools
 * are small on purpose (three names, a few heat and set values), so equal scores, equal names and hot
 * muscles come up all the time.
 */

type PlannedChoice = Readonly<{ index: number; sets: number; targetRir: number | null }>;

type Scenario = {
  library: SuggestExercise[];
  planned: PlannedChoice[];
  heats: Record<MuscleId, number>;
  sets: Record<MuscleId, number>;
  priorities: Record<MuscleId, number>;
  equipment: Equipment[];
  narrowing: Equipment[] | undefined;
  minutes: number;
  shuffleSeed: number[];
};

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

const perMuscle = <Value>(value: fc.Arbitrary<Value>): fc.Arbitrary<Record<MuscleId, Value>> =>
  fc
    .tuple(...MUSCLE_IDS.map(() => value))
    .map((values) => recordInOrder(MUSCLE_IDS, (muscle) => values[MUSCLE_IDS.indexOf(muscle)]));

const muscleEntries = fc.uniqueArray(
  fc.record({
    muscle_id: fc.constantFrom(...MUSCLE_IDS),
    role: fc.constantFrom<MuscleRole>(...MUSCLE_ROLES),
    weight: fc.constantFrom(0.2, 0.5, 1),
  }),
  { selector: (entry) => entry.muscle_id, minLength: 1, maxLength: 5 },
);

const libraries = fc
  .array(
    fc.record({
      name: fc.constantFrom("Alpha", "Bravo", "Charlie"),
      equipment: fc.constantFrom<Equipment>(...EQUIPMENT),
      mechanic: fc.constantFrom<ExerciseMechanic>(...EXERCISE_MECHANICS),
      muscles: muscleEntries,
    }),
    { minLength: 1, maxLength: 14 },
  )
  .map((exercises) =>
    exercises.map((each, index) => ({
      ...each,
      id: `exercise-${String(index).padStart(2, "0")}`,
      muscles: each.muscles.map((entry, position) =>
        position === 0 ? { ...entry, role: "primary" as const } : entry,
      ),
    })),
  );

const scenarios: fc.Arbitrary<Scenario> = fc.record({
  library: libraries,
  planned: fc.uniqueArray(
    fc.record({
      index: fc.nat(13),
      sets: fc.constantFrom(2, 3, 4),
      targetRir: fc.constantFrom(null, 1, 2, 4),
    }),
    { selector: (choice) => choice.index, maxLength: 6 },
  ),
  heats: perMuscle(fc.constantFrom(0, 0.25, 0.5, 0.75)),
  sets: perMuscle(fc.constantFrom(0, 4, 8, 12)),
  priorities: perMuscle(fc.constantFrom(0, 1, 2, 3)),
  equipment: fc.uniqueArray(fc.constantFrom<Equipment>(...EQUIPMENT), {
    minLength: 1,
    maxLength: EQUIPMENT.length,
  }),
  narrowing: fc.option(
    fc.uniqueArray(fc.constantFrom<Equipment>(...EQUIPMENT), {
      minLength: 1,
      maxLength: EQUIPMENT.length,
    }),
    { nil: undefined },
  ),
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

const plannedDayOf = (scenario: Scenario): PlanRoutineDay => ({
  id: PLANNED_DAY_ID,
  position: 0,
  weekday: 3,
  exercises: scenario.planned.flatMap((choice, position) => {
    const exercise = scenario.library[choice.index];
    return exercise === undefined
      ? []
      : [planExerciseOf({ exercise, sets: choice.sets, targetRir: choice.targetRir }, position)];
  }),
});

/** What the goal's equipment and the constraints' equipment both list. */
const usableEquipment = (scenario: Scenario): Equipment[] =>
  scenario.narrowing === undefined
    ? scenario.equipment
    : scenario.equipment.filter((each) => scenario.narrowing?.includes(each));

/** The constraints of a scenario: the planned day, and the narrowing equipment when it has one. */
const constraintsOf = (scenario: Scenario, narrowing: Equipment[] | undefined) => ({
  plannedDay: plannedDayOf(scenario),
  ...(narrowing === undefined ? {} : { equipment: narrowing }),
});

const run = (scenario: Scenario) =>
  suggestSession(
    stateOf(scenario, MUSCLE_IDS),
    goalsOf(scenario, MUSCLE_IDS),
    scenario.library,
    constraintsOf(scenario, scenario.narrowing),
    SUGGEST_PARAMS_V2,
  );

describe("suggestSession on a planned day, properties", () => {
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
          constraintsOf(
            scenario,
            scenario.narrowing && permuted(scenario.narrowing, scenario.shuffleSeed, 5),
          ),
          SUGGEST_PARAMS_V2,
        );
        expect(JSON.stringify(shuffled)).toBe(JSON.stringify(run(scenario)));
      }),
    );
  });

  it("should never read longer than the minutes, and offer nothing when the plan alone does", () => {
    fc.assert(
      fc.property(scenarios, (scenario) => {
        const plan = plannedDayOf(scenario);
        const planOnly = estimateSessionMinutes(
          {
            exercises: plan.exercises.length,
            sets: plan.exercises.reduce((total, each) => total + each.target_sets, 0),
          },
          SESSION_TIME_PARAMS_V1,
        );
        const result = run(scenario);
        if (planOnly > scenario.minutes) {
          expect(result.kind).toBe("nothing");
        }
        if (result.kind === "plan_adjusted") {
          expect(result.planned.minutes).toBe(planOnly);
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

  it("should never reorder or drop a planned exercise, and keep it with its planned sets", () => {
    fc.assert(
      fc.property(scenarios, (scenario) => {
        const plan = plannedDayOf(scenario);
        const result = run(scenario);
        if (result.kind !== "plan_adjusted") {
          return;
        }
        plan.exercises.forEach((planned, position) => {
          const entry = result.exercises[position];
          expect(entry).toStrictEqual({
            origin: "plan",
            routine_exercise_id: planned.id,
            exercise_id: planned.exercise_id,
            sets: planned.target_sets,
            target_rir: planned.target_rir,
          });
        });
        const after = result.exercises.slice(plan.exercises.length);
        expect(after.every((entry) => entry.origin === "added")).toBe(true);
        expect(after.length).toBeLessThanOrEqual(SUGGEST_PARAMS_V2.maxExercises.addedToPlannedDay);
        expect(result.added).toBe(after.length);
        expect(result.added).toBeGreaterThan(0);
      }),
    );
  });

  it("should only add equipment the user has, never twice, and never a hot primary muscle", () => {
    fc.assert(
      fc.property(scenarios, (scenario) => {
        const result = run(scenario);
        if (result.kind !== "plan_adjusted") {
          return;
        }
        const ids = result.exercises.map((exercise) => exercise.exercise_id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const entry of result.exercises) {
          if (entry.origin === "plan") {
            continue;
          }
          const chosen = scenario.library.find((exercise) => exercise.id === entry.exercise_id);
          expect(chosen).toBeDefined();
          expect(usableEquipment(scenario)).toContain(chosen?.equipment);
          for (const muscle of chosen?.muscles ?? []) {
            if (muscle.role === "primary") {
              expect(scenario.heats[muscle.muscle_id]).toBeLessThanOrEqual(
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
        if (result.kind === "plan_adjusted") {
          for (const entry of result.exercises) {
            if (entry.origin !== "plan") {
              for (const reason of entry.reasons) {
                expect(reason.score).toBeGreaterThan(0);
              }
            }
          }
        }
      }),
    );
  });

  it("should carry no name or sentence: an added exercise holds ids and numbers only", () => {
    fc.assert(
      fc.property(scenarios, (scenario) => {
        const result = run(scenario);
        if (result.kind !== "plan_adjusted") {
          return;
        }
        const names = new Set(scenario.library.map((exercise) => exercise.name));
        const text = JSON.stringify(result);
        for (const name of names) {
          expect(text).not.toContain(name);
        }
      }),
    );
  });
});
