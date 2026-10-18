import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  EXPERIENCE_LEVELS,
  proposeNutrition,
  TRAINING_FOCUSES,
  TRAINING_GOALS,
} from "../../src/training";

import type { GoalAnswers } from "../../src/training";

// The ADR 0005 bounds of the protein a proposal may carry, in grams per kilogram of body weight.
const LOWEST_PROTEIN = 1.6;
const HIGHEST_PROTEIN = 2.2;

const goalAnswers: fc.Arbitrary<GoalAnswers> = fc.record({
  goal: fc.constantFrom(...TRAINING_GOALS),
  // Any subset of the focus list, in any order.
  focus: fc.shuffledSubarray([...TRAINING_FOCUSES], { minLength: 0 }),
  days_per_week: fc.integer({ min: 1, max: 7 }),
  session_minutes: fc.integer({ min: 15, max: 180 }),
  equipment: fc.constant(["barbell", "dumbbell"]),
  experience: fc.constantFrom(...EXPERIENCE_LEVELS),
});

describe("proposeNutrition properties", () => {
  it("should keep the protein within 1.6 to 2.2 g per kg for every goal and focus", () => {
    fc.assert(
      fc.property(goalAnswers, (answers) => {
        const { proteinGramsPerKilogram } = proposeNutrition(answers);

        expect(proteinGramsPerKilogram).toBeGreaterThanOrEqual(LOWEST_PROTEIN);
        expect(proteinGramsPerKilogram).toBeLessThanOrEqual(HIGHEST_PROTEIN);
      }),
    );
  });

  it("should give the same proposal for any order of the focus list", () => {
    fc.assert(
      fc.property(goalAnswers, (answers) => {
        const inListOrder = TRAINING_FOCUSES.filter((focus) => answers.focus.includes(focus));

        expect(proposeNutrition(answers)).toStrictEqual(
          proposeNutrition({ ...answers, focus: inListOrder }),
        );
      }),
    );
  });

  it("should not depend on days, minutes, equipment or experience", () => {
    fc.assert(
      fc.property(goalAnswers, goalAnswers, (first, second) => {
        const sameGoalAndFocus = { ...second, goal: first.goal, focus: first.focus };

        expect(proposeNutrition(sameGoalAndFocus)).toStrictEqual(proposeNutrition(first));
      }),
    );
  });
});
