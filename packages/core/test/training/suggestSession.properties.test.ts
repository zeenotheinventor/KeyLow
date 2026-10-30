import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { loggedSets } from "./goldenWeekInputs";
import { FULL_GYM, GOLDEN_LIBRARY } from "./suggestGolden";
import {
  EQUIPMENT,
  estimateSessionMinutes,
  EXERCISE_MECHANICS,
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
  SuggestExercise,
  SuggestGoals,
  SuggestionReason,
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
    {},
    SUGGEST_PARAMS_V2,
  );

/** The reasons given for one muscle, in the order the exercises were picked. */
const reasonsForMuscle = (
  exercises: readonly { reasons: readonly SuggestionReason[] }[],
  muscle: MuscleId,
): SuggestionReason[] =>
  exercises.flatMap((exercise) => exercise.reasons.filter((each) => each.muscle_id === muscle));

describe("suggestSession properties, priority 0", () => {
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

describe("suggestSession properties, weekly sets", () => {
  it("should never raise a muscle's score, and never lower its sets, from one pick to the next", () => {
    fc.assert(
      fc.property(scenarios, (scenario) => {
        const result = run(scenario);
        if (result.kind !== "session") {
          return;
        }
        for (const muscle of MUSCLE_IDS) {
          let earlier: SuggestionReason | undefined;
          for (const reason of reasonsForMuscle(result.exercises, muscle)) {
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

  it("should never give the leading muscle a higher score in its first pick when its weekly sets are raised", () => {
    let compared = 0;
    fc.assert(
      fc.property(scenarios, fc.constantFrom(1, 2, 4), (scenario, extraSets) => {
        const before = run(scenario);
        const lead = before.kind === "session" ? before.exercises[0]?.reasons[0] : undefined;
        if (lead === undefined) {
          return;
        }
        const raised = {
          ...scenario,
          sets: { ...scenario.sets, [lead.muscle_id]: scenario.sets[lead.muscle_id] + extraSets },
        };
        const after = run(raised);
        const sameMuscle =
          after.kind === "session"
            ? reasonsForMuscle(after.exercises.slice(0, 1), lead.muscle_id)[0]
            : undefined;
        if (sameMuscle === undefined) {
          return;
        }
        compared += 1;
        expect(sameMuscle.weekly_sets).toBe(lead.weekly_sets + extraSets);
        expect(sameMuscle.score).toBeLessThanOrEqual(lead.score);
      }),
      CASES,
    );
    expect(compared).toBeGreaterThan(0);
  });
});

describe("suggestSession properties, reasons recomputed", () => {
  const goldenMoments = fc
    .integer({ min: 0, max: 10 * 96 })
    .map((quarterHours) => new Date(Date.UTC(2026, 9, 12) + quarterHours * 900_000).toISOString());

  it("should read every reason's numbers from muscleState and the sets already picked, and score them by the rule", () => {
    fc.assert(
      fc.property(
        goldenMoments,
        perMuscle(fc.constantFrom(0, 1, 2, 3)),
        fc.constantFrom(30, 60, 90),
        fc.constantFrom<Equipment[]>(FULL_GYM, ["dumbbell"], ["barbell", "cable"]),
        (now, priorities, minutes, equipment) => {
          const state = muscleState(loggedSets, now, TRAINING_PARAMS_V2);
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
            {},
            SUGGEST_PARAMS_V2,
          );
          if (result.kind !== "session") {
            return;
          }
          result.exercises.forEach((exercise, position) => {
            const earlierPicks = result.exercises.slice(0, position);
            for (const reason of exercise.reasons) {
              const muscle = reason.muscle_id;
              const setsGivenByEarlierPicks = earlierPicks.reduce(
                (total, pick) =>
                  total +
                  pick.sets *
                    (GOLDEN_LIBRARY.find((each) => each.id === pick.exercise_id)?.muscles.find(
                      (entry) => entry.muscle_id === muscle,
                    )?.weight ?? 0),
                0,
              );
              const productiveFromSets =
                TRAINING_PARAMS_V2.sizeClasses[MUSCLES[muscle].sizeClass].volume.productiveFromSets;

              expect(reason.heat).toBe(state[muscle].heat);
              expect(reason.logged_sets).toBe(state[muscle].weeklySets);
              expect(reason.weekly_sets).toBeCloseTo(
                state[muscle].weeklySets + setsGivenByEarlierPicks,
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

describe("suggestSession properties, error text", () => {
  it("should state the rule only: no exercise name and no priority or minutes value in a RangeError", () => {
    fc.assert(
      fc.property(scenarios, fc.constantFrom(0, -45, -7.5, Number.NaN), (scenario, minutes) => {
        const state = stateOf(scenario, MUSCLE_IDS);
        const goals = goalsOf(scenario, MUSCLE_IDS);
        const attempts = [
          {
            rule: EQUIPMENT_RULE,
            attempt: () =>
              suggestSession(
                state,
                { ...goals, equipment: [] },
                scenario.library,
                {},
                SUGGEST_PARAMS_V2,
              ),
          },
          {
            rule: EQUIPMENT_RULE,
            attempt: () =>
              suggestSession(state, goals, scenario.library, { equipment: [] }, SUGGEST_PARAMS_V2),
          },
          {
            rule: MINUTES_RULE,
            attempt: () =>
              suggestSession(
                state,
                { ...goals, session_minutes: minutes },
                scenario.library,
                {},
                SUGGEST_PARAMS_V2,
              ),
          },
          {
            rule: MINUTES_RULE,
            attempt: () =>
              suggestSession(state, goals, scenario.library, { minutes }, SUGGEST_PARAMS_V2),
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
