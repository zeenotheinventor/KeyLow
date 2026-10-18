import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { routine as goldenRoutine } from "./goldenWeekInputs";
import {
  deriveMusclePriority,
  EXPERIENCE_LEVELS,
  GOAL_PRESETS_V1,
  MUSCLE_IDS,
  summarisePriorities,
  TRAINING_FOCUSES,
  TRAINING_GOALS,
} from "../../src/training";

import type { GoalAnswers } from "../../src/training";

const goalAnswers: fc.Arbitrary<GoalAnswers> = fc.record({
  goal: fc.constantFrom(...TRAINING_GOALS),
  // Any subset of the focus list, in any order.
  focus: fc.shuffledSubarray([...TRAINING_FOCUSES], { minLength: 0 }),
  days_per_week: fc.integer({ min: 1, max: 7 }),
  session_minutes: fc.integer({ min: 15, max: 180 }),
  equipment: fc.constant(["barbell", "dumbbell"]),
  experience: fc.constantFrom(...EXPERIENCE_LEVELS),
});

const routines = fc.constantFrom(undefined, goldenRoutine);

const summaryFor = (answers: GoalAnswers, routine: typeof goldenRoutine | undefined) =>
  summarisePriorities(answers, deriveMusclePriority(answers, GOAL_PRESETS_V1), routine);

describe("summarisePriorities properties", () => {
  it("should give the same summary for any order of the focus list", () => {
    fc.assert(
      fc.property(goalAnswers, routines, (answers, routine) => {
        const inListOrder = TRAINING_FOCUSES.filter((focus) => answers.focus.includes(focus));

        expect(summaryFor(answers, routine)).toStrictEqual(
          summaryFor({ ...answers, focus: inListOrder }, routine),
        );
      }),
    );
  });

  it("should place every one of the 22 muscles in exactly one group, in the order of the list", () => {
    fc.assert(
      fc.property(goalAnswers, routines, (answers, routine) => {
        const { first, keptUp, notTargeted } = summaryFor(answers, routine);

        const grouped = [...first, ...keptUp, ...notTargeted];

        expect(new Set(grouped).size).toBe(MUSCLE_IDS.length);
        expect(grouped).toHaveLength(MUSCLE_IDS.length);
        for (const group of [first, keptUp, notTargeted]) {
          expect(group).toStrictEqual(MUSCLE_IDS.filter((muscle) => group.includes(muscle)));
        }
      }),
    );
  });
});
