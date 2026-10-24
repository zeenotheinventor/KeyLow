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
  it("should be empty for a fresh account", () => {
    expect(savedAnswersOf(freshAccount)).toEqual({});
  });

  it("should carry the saved stats and the active program", () => {
    expect(savedAnswersOf(savedAccount)).toEqual({
      sex: "male",
      birthDate: "1991-03-14",
      heightCm: 180,
      activity: "light",
      goal: "lose",
      ratePctPerWeek: 0.5,
      proteinPreset: "moderate",
      dietStyle: "balanced",
    });
  });

  it("should carry the stats of an account that has no program", () => {
    expect(savedAnswersOf({ ...savedAccount, program: null })).toEqual({
      sex: "male",
      birthDate: "1991-03-14",
      heightCm: 180,
      activity: "light",
    });
  });

  it("should name the protein preset whose figure the program holds", () => {
    const program = (proteinGPerKg: number) =>
      savedAnswersOf({
        ...savedAccount,
        program: savedAccount.program && { ...savedAccount.program, proteinGPerKg },
      }).proteinPreset;

    expect(program(2)).toBe("high");
    expect(program(2.2)).toBe("very_high");
  });

  it("should leave out a value the wizard does not offer", () => {
    const answers = savedAnswersOf({
      ...savedAccount,
      stats: { ...savedAccount.stats, sex: "robot" },
      program: savedAccount.program && {
        ...savedAccount.program,
        proteinGPerKg: 1.7,
        splitPreset: "keto",
      },
    });

    expect(answers).toEqual({
      birthDate: "1991-03-14",
      heightCm: 180,
      activity: "light",
      goal: "lose",
      ratePctPerWeek: 0.5,
    });
  });
});
