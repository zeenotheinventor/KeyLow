import {
  chooseGoal,
  changesOf,
  initialDraftOf,
} from "../components/ProgramEditScreen/programEditDraft";

import type { SetupProgram } from "@keylow/api-client";

const loseHalfPercentModerateBalanced: SetupProgram = {
  id: "66666666-6666-4666-8666-666666666666",
  goal: "lose",
  ratePctPerWeek: 0.5,
  proteinGPerKg: 1.6,
  fatFraction: 0.4,
  splitPreset: "balanced",
};

describe("the Edit programme draft", () => {
  describe("what it starts from", () => {
    it("should be the stored programme for an adult", () => {
      expect(initialDraftOf(loseHalfPercentModerateBalanced, 35)).toEqual({
        goal: "lose",
        ratePctPerWeek: 0.5,
        proteinPreset: "moderate",
        dietStyle: "balanced",
      });
    });

    it("should snap a stored rate that is not a preset to the nearest preset of the goal", () => {
      expect(
        initialDraftOf({ ...loseHalfPercentModerateBalanced, ratePctPerWeek: 0.6 }, 35)
          .ratePctPerWeek,
      ).toBe(0.5);
    });

    it("should start from Maintain with its rate when a stored lose goal is not offered at the age", () => {
      const draft = initialDraftOf(loseHalfPercentModerateBalanced, 16);

      expect(draft.goal).toBe("maintain");
      expect(draft.ratePctPerWeek).toBe(0);
    });

    it("should start from Maintain when the age is unknown, which is read as 0", () => {
      expect(initialDraftOf(loseHalfPercentModerateBalanced, 0).goal).toBe("maintain");
    });

    it("should read the protein preset and the diet style the programme stores", () => {
      const draft = initialDraftOf(
        { ...loseHalfPercentModerateBalanced, proteinGPerKg: 2.2, splitPreset: "low_carb" },
        35,
      );

      expect(draft.proteinPreset).toBe("very_high");
      expect(draft.dietStyle).toBe("low_carb");
    });
  });

  describe("choosing a goal", () => {
    const draft = initialDraftOf(loseHalfPercentModerateBalanced, 35);

    it("should bring the new goal's default rate back", () => {
      expect(chooseGoal(draft, "gain")).toEqual({ ...draft, goal: "gain", ratePctPerWeek: 0.25 });
      expect(chooseGoal(draft, "maintain")).toEqual({
        ...draft,
        goal: "maintain",
        ratePctPerWeek: 0,
      });
    });

    it("should keep the rate when the same goal is chosen again", () => {
      expect(chooseGoal({ ...draft, ratePctPerWeek: 0.75 }, "lose").ratePctPerWeek).toBe(0.75);
    });
  });

  describe("the changes it makes", () => {
    it("should carry the goal, the rate, the protein grams per kilogram and the diet's fat fraction and key", () => {
      expect(
        changesOf({
          goal: "gain",
          ratePctPerWeek: 0.1,
          proteinPreset: "high",
          dietStyle: "low_fat",
        }),
      ).toEqual({
        goal: "gain",
        ratePctPerWeek: 0.1,
        proteinGPerKg: 2,
        fatFraction: 0.28,
        splitPreset: "low_fat",
      });
    });
  });
});
