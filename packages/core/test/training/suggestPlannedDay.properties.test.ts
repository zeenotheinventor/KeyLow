import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { loggedSets } from "./goldenWeekInputs";
import { FULL_GYM, GOLDEN_LIBRARY } from "./suggestGolden";
import { PLANNED_DAY_ID, planExerciseOf } from "./suggestPlanInputs";
import {
  EQUIPMENT,
  EXERCISE_MECHANICS,
  estimateSessionMinutes,
  MUSCLE_IDS,
  MUSCLE_ROLES,
  MUSCLES,
  muscleState,
  SESSION_TIME_PARAMS_V1,
  suggestSession,
  SUGGEST_PARAMS_V2,
  TRAINING_PARAMS_V2,
} from "../../src/training";

import type {
  Equipment,
  ExerciseMechanic,
  MuscleId,
  MuscleRole,
  PlanRoutineDay,
  SuggestExercise,
  SuggestedExercise,
  SuggestGoals,
  SuggestionReason,
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

/*
 * The properties below run 200 cases each (KEY-403). The rule and the formula they are checked against are
 * written out here, never read back from the code under test.
 */
const CASES = { numRuns: 200 };

const EQUIPMENT_RULE = "Suggestions need at least one piece of equipment";
const MINUTES_RULE = "The session minutes must be greater than 0";

/** The message of the `RangeError` that `attempt` throws. */
const messageOfThrown = (attempt: () => unknown): string => {
  try {
    attempt();
  } catch (error) {
    if (error instanceof RangeError) {
      return error.message;
    }
    throw error;
  }
  throw new Error("Expected a RangeError");
};

/** The priorities a user has set above 0: what a goals row holds when a muscle was never given a priority. */
const positivePriorities = (scenario: Scenario): Partial<Record<MuscleId, number>> =>
  Object.fromEntries(
    MUSCLE_IDS.flatMap((muscle): [MuscleId, number][] =>
      scenario.priorities[muscle] > 0 ? [[muscle, scenario.priorities[muscle]]] : [],
    ),
  );

/** `priorities` with an explicit 0 added for each chosen muscle that has no priority yet. */
const withZeroPriorities = (
  priorities: Partial<Record<MuscleId, number>>,
  chosen: Record<MuscleId, boolean>,
): Partial<Record<MuscleId, number>> => ({
  ...Object.fromEntries(
    MUSCLE_IDS.filter((muscle) => chosen[muscle]).map((muscle): [MuscleId, number] => [muscle, 0]),
  ),
  ...priorities,
});

const runWithPriorities = (scenario: Scenario, priorities: Partial<Record<MuscleId, number>>) =>
  suggestSession(
    stateOf(scenario, MUSCLE_IDS),
    { ...goalsOf(scenario, MUSCLE_IDS), muscle_priority: priorities },
    scenario.library,
    constraintsOf(scenario, scenario.narrowing),
    SUGGEST_PARAMS_V2,
  );

/** The exercises added to the day, in the order they were picked. */
const addedOf = (result: ReturnType<typeof run>): SuggestedExercise[] =>
  result.kind === "plan_adjusted"
    ? result.exercises.flatMap((entry) => (entry.origin === "added" ? [entry] : []))
    : [];

/** The reasons given for one muscle, in the order the exercises were picked. */
const reasonsForMuscle = (
  exercises: readonly SuggestedExercise[],
  muscle: MuscleId,
): SuggestionReason[] =>
  exercises.flatMap((exercise) => exercise.reasons.filter((each) => each.muscle_id === muscle));

describe("suggestSession on a planned day, properties, priority 0", () => {
  it("should give the same bytes whether a muscle with priority 0 is left out of the goals or listed at 0", () => {
    fc.assert(
      fc.property(scenarios, perMuscle(fc.boolean()), (scenario, listedAtZero) => {
        const sparse = positivePriorities(scenario);
        const expected = JSON.stringify(runWithPriorities(scenario, sparse));
        expect(
          JSON.stringify(runWithPriorities(scenario, withZeroPriorities(sparse, listedAtZero))),
        ).toBe(expected);
        expect(JSON.stringify(run(scenario))).toBe(expected);
      }),
      CASES,
    );
  });
});

describe("suggestSession on a planned day, properties, weekly sets", () => {
  it("should never raise a muscle's score, and never lower its sets, from one added exercise to the next", () => {
    fc.assert(
      fc.property(scenarios, (scenario) => {
        const added = addedOf(run(scenario));
        for (const muscle of MUSCLE_IDS) {
          let earlier: SuggestionReason | undefined;
          for (const reason of reasonsForMuscle(added, muscle)) {
            if (earlier !== undefined) {
              expect(reason.weekly_sets).toBeGreaterThanOrEqual(earlier.weekly_sets);
              expect(reason.score).toBeLessThanOrEqual(earlier.score);
              expect(reason.heat).toBe(earlier.heat);
              expect(reason.priority).toBe(earlier.priority);
              expect(reason.logged_sets).toBe(earlier.logged_sets);
            }
            earlier = reason;
          }
        }
      }),
      CASES,
    );
  });

  it("should never give the leading muscle a higher score in the first added exercise when its weekly sets are raised", () => {
    let compared = 0;
    fc.assert(
      fc.property(scenarios, fc.constantFrom(1, 2, 4), (scenario, extraSets) => {
        const lead = addedOf(run(scenario))[0]?.reasons[0];
        if (lead === undefined) {
          return;
        }
        const raised = {
          ...scenario,
          sets: { ...scenario.sets, [lead.muscle_id]: scenario.sets[lead.muscle_id] + extraSets },
        };
        const sameMuscle = reasonsForMuscle(addedOf(run(raised)).slice(0, 1), lead.muscle_id)[0];
        if (sameMuscle === undefined) {
          return;
        }
        compared += 1;
        expect(sameMuscle.weekly_sets).toBeCloseTo(lead.weekly_sets + extraSets, 6);
        expect(sameMuscle.score).toBeLessThanOrEqual(lead.score);
      }),
      CASES,
    );
    expect(compared).toBeGreaterThan(0);
  });
});

describe("suggestSession on a planned day, properties, reasons recomputed", () => {
  const goldenMoments = fc
    .integer({ min: 0, max: 10 * 96 })
    .map((quarterHours) => new Date(Date.UTC(2026, 9, 12) + quarterHours * 900_000).toISOString());

  it("should read every reason's numbers from muscleState, the planned sets and the sets already added, and score them by the rule", () => {
    fc.assert(
      fc.property(
        goldenMoments,
        perMuscle(fc.constantFrom(0, 1, 2, 3)),
        fc.uniqueArray(fc.nat(GOLDEN_LIBRARY.length - 1), { maxLength: 3 }),
        fc.constantFrom(2, 3, 4),
        fc.constantFrom(30, 60, 90),
        fc.constantFrom<Equipment[]>(FULL_GYM, ["dumbbell"], ["barbell", "cable"]),
        (now, priorities, plannedIndexes, plannedSets, minutes, equipment) => {
          const state = muscleState(loggedSets, now, TRAINING_PARAMS_V2);
          // A planned set with no target RIR counts in full, so the plan's credit is its sets times the weight.
          const planned = plannedIndexes.flatMap((index, position) => {
            const exercise = GOLDEN_LIBRARY[index];
            return exercise === undefined
              ? []
              : [planExerciseOf({ exercise, sets: plannedSets, targetRir: null }, position)];
          });
          const result = suggestSession(
            state,
            {
              goal: "aesthetic",
              experience: "intermediate",
              equipment,
              session_minutes: minutes,
              muscle_priority: priorities,
            },
            GOLDEN_LIBRARY,
            { plannedDay: { id: PLANNED_DAY_ID, position: 0, weekday: 3, exercises: planned } },
            SUGGEST_PARAMS_V2,
          );
          const added = addedOf(result);
          added.forEach((exercise, position) => {
            const earlierPicks = added.slice(0, position);
            for (const reason of exercise.reasons) {
              const muscle = reason.muscle_id;
              const weightOf = (exerciseId: string): number =>
                GOLDEN_LIBRARY.find((each) => each.id === exerciseId)?.muscles.find(
                  (entry) => entry.muscle_id === muscle,
                )?.weight ?? 0;
              const setsGivenByPlan = planned.reduce(
                (total, each) =>
                  total +
                  each.target_sets * TRAINING_PARAMS_V2.effort.unknown * weightOf(each.exercise_id),
                0,
              );
              const setsGivenByEarlierPicks = earlierPicks.reduce(
                (total, pick) => total + pick.sets * weightOf(pick.exercise_id),
                0,
              );
              const productiveFromSets =
                TRAINING_PARAMS_V2.sizeClasses[MUSCLES[muscle].sizeClass].volume.productiveFromSets;

              expect(reason.heat).toBe(state[muscle].heat);
              expect(reason.logged_sets).toBe(state[muscle].weeklySets);
              expect(reason.weekly_sets).toBeCloseTo(
                state[muscle].weeklySets + setsGivenByPlan + setsGivenByEarlierPicks,
                6,
              );
              expect(reason.priority).toBe(priorities[muscle]);
              expect(reason.mav_low).toBe(productiveFromSets);
              expect(reason.score).toBeCloseTo(
                reason.priority *
                  Math.max(0, productiveFromSets - reason.weekly_sets) *
                  (1 - reason.heat),
                6,
              );
            }
          });
        },
      ),
      CASES,
    );
  });
});

describe("suggestSession on a planned day, properties, error text", () => {
  it("should state the rule only: no exercise name and no priority or minutes value in a RangeError", () => {
    fc.assert(
      fc.property(scenarios, fc.constantFrom(0, -45, -7.5, Number.NaN), (scenario, minutes) => {
        const state = stateOf(scenario, MUSCLE_IDS);
        const goals = goalsOf(scenario, MUSCLE_IDS);
        const { plannedDay } = constraintsOf(scenario, undefined);
        const attempts = [
          {
            rule: EQUIPMENT_RULE,
            attempt: () =>
              suggestSession(
                state,
                { ...goals, equipment: [] },
                scenario.library,
                { plannedDay },
                SUGGEST_PARAMS_V2,
              ),
          },
          {
            rule: EQUIPMENT_RULE,
            attempt: () =>
              suggestSession(
                state,
                goals,
                scenario.library,
                { plannedDay, equipment: [] },
                SUGGEST_PARAMS_V2,
              ),
          },
          {
            rule: MINUTES_RULE,
            attempt: () =>
              suggestSession(
                state,
                { ...goals, session_minutes: minutes },
                scenario.library,
                { plannedDay },
                SUGGEST_PARAMS_V2,
              ),
          },
          {
            rule: MINUTES_RULE,
            attempt: () =>
              suggestSession(
                state,
                goals,
                scenario.library,
                { plannedDay, minutes },
                SUGGEST_PARAMS_V2,
              ),
          },
        ];
        for (const { rule, attempt } of attempts) {
          const message = messageOfThrown(attempt);
          expect(message).toBe(rule);
          for (const exercise of scenario.library) {
            expect(message).not.toContain(exercise.name);
          }
          for (const priority of Object.values(scenario.priorities)) {
            if (priority > 0) {
              expect(message).not.toContain(String(priority));
            }
          }
          if (minutes !== 0) {
            expect(message).not.toContain(String(minutes));
          }
        }
      }),
      CASES,
    );
  });
});
