import { savedAnswersOf } from "../../components/SetupScreen/savedAnswers";

import type { SetupState } from "@keylow/api-client";

const freshAccount: SetupState = {
  isSetUp: false,
  stats: { sex: null, birthDate: null, heightCm: null, activity: null, weightUnit: null },
  program: null,
  latestWeighIn: null,
};

const savedAccount: SetupState = {
  isSetUp: true,
  stats: {
    sex: "male",
    birthDate: "1991-03-14",
    heightCm: 180,
    activity: "light",
    weightUnit: "kg",
  },
  program: {
    id: "66666666-6666-4666-8666-666666666666",
    goal: "lose",
    ratePctPerWeek: 0.5,
    proteinGPerKg: 1.6,
    fatFraction: 0.4,
    splitPreset: "balanced",
  },
  latestWeighIn: { weightKg: 80, localDate: "2026-10-21" },
};

describe("savedAnswersOf", () => {
  it("should hold only the units from the region for a fresh account", () => {
    expect(savedAnswersOf(freshAccount, "GB")).toEqual({ weightUnit: "kg", heightUnit: "cm" });
  });

  it("should carry the saved stats and the active program", () => {
    expect(savedAnswersOf(savedAccount, "GB")).toEqual({
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
    });
  });

  it("should carry the stats of an account that has no program", () => {
    expect(savedAnswersOf({ ...savedAccount, program: null }, "GB")).toEqual({
      sex: "male",
      birthDate: "1991-03-14",
      heightCm: 180,
      weightKg: 80,
      weightUnit: "kg",
      heightUnit: "cm",
      activity: "light",
    });
  });

  it("should name the protein preset whose figure the program holds", () => {
    const program = (proteinGPerKg: number) =>
      savedAnswersOf(
        {
          ...savedAccount,
          program: savedAccount.program && { ...savedAccount.program, proteinGPerKg },
        },
        "GB",
      ).proteinPreset;

    expect(program(2)).toBe("high");
    expect(program(2.2)).toBe("very_high");
  });

  it("should leave out a value the wizard does not offer", () => {
    const answers = savedAnswersOf(
      {
        ...savedAccount,
        stats: { ...savedAccount.stats, sex: "robot" },
        program: savedAccount.program && {
          ...savedAccount.program,
          proteinGPerKg: 1.7,
          splitPreset: "keto",
        },
      },
      "GB",
    );

    expect(answers).toEqual({
      birthDate: "1991-03-14",
      heightCm: 180,
      weightKg: 80,
      weightUnit: "kg",
      heightUnit: "cm",
      activity: "light",
      goal: "lose",
      ratePctPerWeek: 0.5,
    });
  });

  describe("the units the body step opens in", () => {
    const withStoredUnit = (weightUnit: string | null): SetupState => ({
      ...freshAccount,
      stats: { ...freshAccount.stats, weightUnit },
    });

    it.each([
      ["US", "lb", "ft_in"],
      ["LR", "lb", "ft_in"],
      ["MM", "lb", "ft_in"],
      ["GB", "kg", "cm"],
      ["DE", "kg", "cm"],
    ])(
      "should start from the region %s in %s and %s when nothing is stored",
      (region, weightUnit, heightUnit) => {
        expect(savedAnswersOf(withStoredUnit(null), region)).toEqual({ weightUnit, heightUnit });
      },
    );

    it("should start from kilograms and centimetres when the region is not known", () => {
      expect(savedAnswersOf(withStoredUnit(null), undefined)).toEqual({
        weightUnit: "kg",
        heightUnit: "cm",
      });
    });

    it("should open a stored kg in kg and cm whatever the region", () => {
      expect(savedAnswersOf(withStoredUnit("kg"), "US")).toEqual({
        weightUnit: "kg",
        heightUnit: "cm",
      });
    });

    it("should open a stored lb in lb and feet and inches whatever the region", () => {
      expect(savedAnswersOf(withStoredUnit("lb"), "DE")).toEqual({
        weightUnit: "lb",
        heightUnit: "ft_in",
      });
    });

    it("should read a stored unit the profile cannot hold as none stored, so the region decides", () => {
      expect(savedAnswersOf(withStoredUnit("stone"), "US")).toEqual({
        weightUnit: "lb",
        heightUnit: "ft_in",
      });
    });

    it("should open a stored st in lb and feet and inches, because the wizard has no stones", () => {
      expect(savedAnswersOf(withStoredUnit("st"), "GB")).toEqual({
        weightUnit: "lb",
        heightUnit: "ft_in",
      });
    });
  });

  describe("the weight", () => {
    it("should come from the latest weigh-in, in kilograms, whatever its date", () => {
      const answers = savedAnswersOf(
        { ...freshAccount, latestWeighIn: { weightKg: 63.4, localDate: "2025-01-02" } },
        "GB",
      );

      expect(answers.weightKg).toBe(63.4);
    });

    it("should be left out when there is no weigh-in, because there is no onboarding weight before setup", () => {
      expect(savedAnswersOf({ ...savedAccount, latestWeighIn: null }, "GB")).not.toHaveProperty(
        "weightKg",
      );
    });
  });
});
