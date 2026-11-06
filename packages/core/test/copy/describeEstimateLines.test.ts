import { describe, expect, it } from "vitest";

import { describeEstimateLines } from "../../src/copy";
import { startingPlan } from "../../src/setup";

import type { SetupAnswers } from "../../src/setup";

/*
 * The goldens are the web setup proposal's: the main sample (1,970 kcal), the floor (1,200 kcal) and the
 * deficit cap (2,390 kcal). Every expected sentence is a literal.
 */

const TODAY = "2026-10-23";

const mainSample: SetupAnswers = {
  sex: "male",
  birthDate: "1991-03-14",
  heightCm: 180,
  weightKg: 80,
  weightUnit: "kg",
  heightUnit: "cm",
  activity: "light",
  goal: "lose",
  ratePctPerWeek: 0.5,
  proteinPreset: "moderate",
  dietStyle: "balanced",
};

const floorSample: SetupAnswers = {
  ...mainSample,
  sex: "female",
  birthDate: "1996-10-23",
  heightCm: 160,
  weightKg: 55,
  activity: "sedentary",
  ratePctPerWeek: 1,
};

const floorAboveExpenditureSample: SetupAnswers = {
  ...floorSample,
  birthDate: "1976-10-23",
  heightCm: 150,
  weightKg: 40,
  ratePctPerWeek: 0.5,
};

const deficitCapSample: SetupAnswers = {
  ...mainSample,
  birthDate: "1986-10-23",
  heightCm: 175,
  weightKg: 130,
  activity: "moderate",
  ratePctPerWeek: 1,
};

const linesOf = (answers: SetupAnswers) =>
  describeEstimateLines(answers, startingPlan(answers, TODAY, null));

describe("describeEstimateLines", () => {
  it("should give the rate line and no guardrail line when nothing set the calories", () => {
    expect(linesOf(mainSample)).toEqual({
      rateLine: "To lose about 0.4 kg a week (0.5% of your weight).",
      guardrailLines: [],
    });
  });

  it("should give the maintain line for a person who keeps their weight", () => {
    expect(linesOf({ ...mainSample, goal: "maintain", ratePctPerWeek: 0 })).toEqual({
      rateLine: "To keep your weight about where it is.",
      guardrailLines: [],
    });
  });

  it("should replace the rate line with the floor line when the floor set the calories", () => {
    expect(linesOf(floorSample)).toEqual({
      rateLine: undefined,
      guardrailLines: [
        "Raised to 1,200 kcal, the lowest target Ki-Lo sets for you. You would lose about 0.3 kg a week (0.47% of your weight), not 1.0%.",
      ],
    });
  });

  it("should add the advice to talk to someone when the floor is above expenditure", () => {
    expect(linesOf(floorAboveExpenditureSample).guardrailLines).toEqual([
      "Raised to 1,200 kcal, the lowest target Ki-Lo sets for you. That is more than your estimated expenditure of 1,112 kcal, so you would gain about 0.1 kg a week (0.20% of your weight), not lose it. Talk to a doctor or dietitian before you try to lose more weight.",
    ]);
  });

  it("should replace the rate line with the 30% deficit line when the deficit cap set the calories", () => {
    expect(linesOf(deficitCapSample)).toEqual({
      rateLine: undefined,
      guardrailLines: [
        "Kept to a 30% deficit, the most Ki-Lo sets. You would lose about 0.9 kg a week (0.71% of your weight), not 1.0%.",
      ],
    });
  });

  it("should follow the binding line with the macro fit line when protein was lowered to fit", () => {
    const answers: SetupAnswers = {
      ...mainSample,
      birthDate: "1936-03-14",
      heightCm: 150,
      weightKg: 150,
      ratePctPerWeek: 1,
      proteinPreset: "very_high",
    };

    expect(linesOf(answers).guardrailLines).toEqual([
      "Kept to a 30% deficit, the most Ki-Lo sets. You would lose about 0.7 kg a week (0.50% of your weight), not 1.0%.",
      "Protein was lowered to 311 g so that it fits in 1,920 kcal with the least fat Ki-Lo sets (75 g). Carbohydrate is 0 g.",
    ]);
  });
});
