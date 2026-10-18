import { describe, expect, it } from "vitest";

import { NUTRITION_PROPOSALS_V1, proposeNutrition } from "../../src/training";

import type { GoalAnswers, TrainingFocus, TrainingGoal } from "../../src/training";

/*
 * The nutrition bridge of the goal presets v1 that Zee agreed on 2026-10-18 (Linear document "Goal presets
 * and golden suggestions", on KEY-396, Part 6). Every number below is copied from that document as a
 * literal. Only V-taper changes the proposal: it wins over any goal and any other focus.
 */

const answersFor = (goal: TrainingGoal, focus: readonly TrainingFocus[]): GoalAnswers => ({
  goal,
  focus: [...focus],
  days_per_week: 4,
  session_minutes: 60,
  equipment: ["barbell", "dumbbell"],
  experience: "intermediate",
});

describe("NUTRITION_PROPOSALS_V1", () => {
  it("should hold exactly the values Zee agreed", () => {
    expect(NUTRITION_PROPOSALS_V1).toStrictEqual({
      version: "keylow-training-v1",
      withoutVTaper: {
        aesthetic: {
          direction: "lean_gain",
          weeklyRatePercent: 0.25,
          proteinGramsPerKilogram: 2.0,
        },
        strength: {
          direction: "slight_surplus",
          weeklyRatePercent: 0.1,
          proteinGramsPerKilogram: 1.8,
        },
        hybrid: { direction: "lean_gain", weeklyRatePercent: 0.15, proteinGramsPerKilogram: 2.0 },
      },
      withVTaper: {
        aesthetic: { direction: "maintain", weeklyRatePercent: 0, proteinGramsPerKilogram: 2.0 },
        strength: { direction: "maintain", weeklyRatePercent: 0, proteinGramsPerKilogram: 2.0 },
        hybrid: { direction: "maintain", weeklyRatePercent: 0, proteinGramsPerKilogram: 2.0 },
      },
    });
  });
});

describe("proposeNutrition", () => {
  it("should propose maintenance at 2.0 g per kg for the golden V-taper user, as the canvas shows", () => {
    const goldenAnswers: GoalAnswers = {
      goal: "aesthetic",
      focus: ["v_taper"],
      days_per_week: 4,
      session_minutes: 60,
      equipment: ["barbell", "dumbbell", "kettlebell", "cable", "machine", "smith_machine"],
      experience: "intermediate",
    };

    expect(proposeNutrition(goldenAnswers)).toStrictEqual({
      direction: "maintain",
      weeklyRatePercent: 0,
      proteinGramsPerKilogram: 2.0,
    });
  });

  describe("without V-taper", () => {
    it.each<[TrainingGoal, string, number, number]>([
      ["aesthetic", "lean_gain", 0.25, 2.0],
      ["strength", "slight_surplus", 0.1, 1.8],
      ["hybrid", "lean_gain", 0.15, 2.0],
    ])(
      "should propose for %s: %s, %s percent a week, %s g per kg",
      (goal, direction, rate, protein) => {
        expect(proposeNutrition(answersFor(goal, ["chest"]))).toStrictEqual({
          direction,
          weeklyRatePercent: rate,
          proteinGramsPerKilogram: protein,
        });
      },
    );

    it.each<[TrainingFocus[]]>([[[]], [["overall"]], [["arms"]], [["glutes", "legs"]]])(
      "should propose the same for the focus %j as for chest",
      (focus) => {
        expect(proposeNutrition(answersFor("strength", focus))).toStrictEqual(
          proposeNutrition(answersFor("strength", ["chest"])),
        );
      },
    );
  });

  describe("with V-taper", () => {
    it.each<[TrainingGoal]>([["aesthetic"], ["strength"], ["hybrid"]])(
      "should propose maintenance at 2.0 g per kg for %s",
      (goal) => {
        expect(proposeNutrition(answersFor(goal, ["v_taper"]))).toStrictEqual({
          direction: "maintain",
          weeklyRatePercent: 0,
          proteinGramsPerKilogram: 2.0,
        });
      },
    );

    it("should win over every other focus chosen with it", () => {
      expect(
        proposeNutrition(answersFor("strength", ["chest", "overall", "v_taper", "legs"])),
      ).toStrictEqual({
        direction: "maintain",
        weeklyRatePercent: 0,
        proteinGramsPerKilogram: 2.0,
      });
    });
  });

  it("should not change the answers it was given", () => {
    const answers = answersFor("hybrid", ["legs", "v_taper"]);

    proposeNutrition(answers);

    expect(answers).toStrictEqual(answersFor("hybrid", ["legs", "v_taper"]));
  });

  describe("answers that fail the questionnaire rules", () => {
    it("should throw a RangeError stating the rule", () => {
      const answers = answersFor("aesthetic", ["v_taper", "v_taper"]);

      expect(() => proposeNutrition(answers)).toThrow(RangeError);
      expect(() => proposeNutrition(answers)).toThrow("A focus can be chosen at most once");
    });

    it("should never quote the offending value, because a goal answer is health data", () => {
      const answers = { ...answersFor("aesthetic", []), session_minutes: 123456 };

      expect(() => proposeNutrition(answers)).toThrow(RangeError);
      expect(() => proposeNutrition(answers)).not.toThrow("123456");
    });
  });
});
