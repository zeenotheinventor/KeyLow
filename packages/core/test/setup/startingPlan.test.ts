import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";

import { DEFAULT_ENGINE_PARAMS } from "../../src/engine";
import { startingPlan } from "../../src/setup";

import type { SetupAnswers, SetupClamp, StartingPlan } from "../../src/setup";

const TODAY = "2026-06-15";

/** Male, 36 years on TODAY, 180 cm, 80 kg, light, maintain: BMR 1750 and expenditure 2406.25. */
const maleOfThirtySix: SetupAnswers = {
  sex: "male",
  birthDate: "1990-06-15",
  heightCm: 180,
  weightKg: 80,
  weightUnit: "kg",
  heightUnit: "cm",
  activity: "light",
  goal: "maintain",
  ratePctPerWeek: 0,
  proteinPreset: "moderate",
  dietStyle: "balanced",
};

/** The Build Plan's man: 35 years on TODAY, BMR 1755 and expenditure 2413.125. */
const maleOfThirtyFive: SetupAnswers = { ...maleOfThirtySix, birthDate: "1991-06-15" };

const femaleAtTheFloor: SetupAnswers = {
  sex: "female",
  birthDate: "1996-06-15",
  heightCm: 160,
  weightKg: 55,
  weightUnit: "kg",
  heightUnit: "cm",
  activity: "sedentary",
  goal: "lose",
  ratePctPerWeek: 1.0,
  proteinPreset: "moderate",
  dietStyle: "balanced",
};

/** BMR 926.5 and expenditure 1111.8, so the floor of 1200 sits above it. */
const femaleFloorAboveExpenditure: SetupAnswers = {
  sex: "female",
  birthDate: "1976-06-15",
  heightCm: 150,
  weightKg: 40,
  weightUnit: "kg",
  heightUnit: "cm",
  activity: "sedentary",
  goal: "lose",
  ratePctPerWeek: 0.5,
  proteinPreset: "moderate",
  dietStyle: "balanced",
};

/** Expenditure 5638.25 and an uncapped gain target of 6630, which the profile range cuts to 6000. */
const hugeAndVeryActive: SetupAnswers = {
  sex: "male",
  birthDate: "1996-06-15",
  heightCm: 210,
  weightKg: 180,
  weightUnit: "kg",
  heightUnit: "cm",
  activity: "extra",
  goal: "gain",
  ratePctPerWeek: 0.5,
  proteinPreset: "moderate",
  dietStyle: "balanced",
};

describe("startingPlan goldens", () => {
  it("should give BMR 1750, expenditure 2406.25 and calories 2410 for the man of 36 at maintain", () => {
    const plan = startingPlan(maleOfThirtySix, TODAY, null);

    expect(plan.estimate).toStrictEqual({ bmrKcal: 1750, expenditureKcal: 2406.25 });
    expect(plan.targets.caloriesKcal).toBe(2410);
    expect(plan.save.program.rate_pct_per_week).toBe(0);
  });

  it("should give macros of 128 g protein, 84 g fat and 286 g carbs for the man of 36", () => {
    const { targets } = startingPlan(maleOfThirtySix, TODAY, null);

    expect(targets).toStrictEqual({ caloriesKcal: 2410, proteinG: 128, fatG: 84, carbsG: 286 });
  });

  it("should give macros that add up to the calories within 6 kcal", () => {
    const { targets } = startingPlan(maleOfThirtySix, TODAY, null);

    expect(
      Math.abs(4 * targets.proteinG + 9 * targets.fatG + 4 * targets.carbsG - targets.caloriesKcal),
    ).toBeLessThanOrEqual(6);
  });

  it("should reproduce BMR 1755, the unrounded expenditure 2413.125 and calories 2410 at age 35", () => {
    const plan = startingPlan(maleOfThirtyFive, TODAY, null);

    expect(plan.estimate).toStrictEqual({ bmrKcal: 1755, expenditureKcal: 2413.125 });
    expect(plan.targets.caloriesKcal).toBe(2410);
  });

  it("should record no clamps and a zero effective rate at maintain", () => {
    const plan = startingPlan(maleOfThirtyFive, TODAY, null);

    expect(plan.clamps).toStrictEqual([]);
    expect(plan.effectiveRatePctPerWeek).toBe(0);
  });

  it("should give 1970 kcal, P 128 g, C 218 g and F 65 g for the man of 35 losing 0.5 percent a week", () => {
    const plan = startingPlan(
      { ...maleOfThirtyFive, goal: "lose", ratePctPerWeek: 0.5 },
      TODAY,
      null,
    );

    expect(plan.targets).toStrictEqual({
      caloriesKcal: 1970,
      proteinG: 128,
      fatG: 65,
      carbsG: 218,
    });
    expect(plan.clamps).toStrictEqual([]);
  });
});

describe("startingPlan guardrails", () => {
  it("should raise a woman's lose target to the 1200 floor and report a lower effective rate", () => {
    const plan = startingPlan(femaleAtTheFloor, TODAY, null);

    expect(plan.estimate.bmrKcal).toBe(1239);
    expect(plan.targets.caloriesKcal).toBe(1200);
    expect(plan.clamps).toContain("floor");
    expect(plan.clamps).toStrictEqual(["max_deficit", "floor"]);
    expect(plan.effectiveRatePctPerWeek).toBeCloseTo(0.474, 3);
    expect(plan.effectiveRatePctPerWeek).toBeLessThan(femaleAtTheFloor.ratePctPerWeek);
  });

  it("should give 1200 with the floor clamp and a negative effective rate when the floor is above expenditure", () => {
    const plan = startingPlan(femaleFloorAboveExpenditure, TODAY, null);

    expect(plan.estimate.expenditureKcal).toBeCloseTo(1111.8, 6);
    expect(plan.targets.caloriesKcal).toBe(1200);
    expect(plan.clamps).toStrictEqual(["floor"]);
    expect(plan.effectiveRatePctPerWeek).toBeCloseTo(-0.2005, 4);
    expect(plan.effectiveRatePctPerWeek).toBeLessThan(0);
  });
});

describe("startingPlan profile maximum", () => {
  it("should cap a huge, very active person's calories at 6000 and record profile_max", () => {
    const plan = startingPlan(hugeAndVeryActive, TODAY, null);

    expect(plan.estimate.expenditureKcal).toBeCloseTo(5638.25, 6);
    expect(plan.targets.caloriesKcal).toBe(6000);
    expect(plan.clamps).toStrictEqual(["profile_max"]);
  });

  it("should re-derive the macros from the capped calories, not keep those of the uncapped 6630", () => {
    const { targets } = startingPlan(hugeAndVeryActive, TODAY, null);

    expect(targets).toStrictEqual({
      caloriesKcal: 6000,
      proteinG: 288,
      fatG: 215,
      carbsG: 728,
    });
    expect(
      Math.abs(4 * targets.proteinG + 9 * targets.fatG + 4 * targets.carbsG - 6000),
    ).toBeLessThanOrEqual(6);
  });

  it("should store the capped calories and the re-derived macros in save.profile", () => {
    const { save } = startingPlan(hugeAndVeryActive, TODAY, null);

    expect(save.profile).toMatchObject({
      target_kcal: 6000,
      target_protein_g: 288,
      target_fat_g: 215,
      target_carbs_g: 728,
    });
  });

  it("should report the effective rate of the capped 6000 kcal, not of the uncapped 6630", () => {
    const plan = startingPlan(hugeAndVeryActive, TODAY, null);

    expect(plan.effectiveRatePctPerWeek).toBeCloseTo(0.1827, 4);
  });

  it("should keep the macros of any capped gain within 6 kcal of 6000", () => {
    let cappedCases = 0;

    fc.assert(
      fc.property(
        fc.integer({ min: 120, max: 250 }),
        fc.integer({ min: 170, max: 250 }),
        fc.constantFrom("male", "female", "other"),
        fc.constantFrom(0.1, 0.25, 0.5),
        (weightKg, heightCm, sex, ratePctPerWeek) => {
          const plan = startingPlan(
            { ...hugeAndVeryActive, weightKg, heightCm, sex, ratePctPerWeek },
            TODAY,
            null,
          );
          if (!plan.clamps.includes("profile_max")) {
            return true;
          }
          cappedCases += 1;
          const { caloriesKcal, proteinG, fatG, carbsG } = plan.targets;
          return (
            caloriesKcal === 6000 && Math.abs(4 * proteinG + 9 * fatG + 4 * carbsG - 6000) <= 6
          );
        },
      ),
    );

    expect(cappedCases).toBeGreaterThan(0);
  });

  it("should record macro_fit once, after profile_max, when the capped calories cannot hold the fat floor", () => {
    const params = {
      ...DEFAULT_ENGINE_PARAMS,
      targets: { ...DEFAULT_ENGINE_PARAMS.targets, fatMinGPerKg: 5 },
    };

    const plan = startingPlan(hugeAndVeryActive, TODAY, null, params);

    expect(plan.targets).toStrictEqual({ caloriesKcal: 6000, proteinG: 0, fatG: 666, carbsG: 0 });
    expect(plan.clamps).toStrictEqual(["profile_max", "macro_fit"]);
  });

  it("should admit profile_max in the type of the clamps while the engine's clamps do not", () => {
    expectTypeOf<StartingPlan["clamps"]>().toEqualTypeOf<readonly SetupClamp[]>();
    expectTypeOf<"profile_max">().toExtend<StartingPlan["clamps"][number]>();
  });
});

describe("startingPlan under 18", () => {
  const seventeenAndOldEnough = "2009-06-15";
  const eighteenToday = "2008-06-15";
  const seventeenForOneMoreDay = "2008-06-16";

  it("should throw a RangeError that names the rule when a person under 18 chooses lose", () => {
    const answers: SetupAnswers = {
      ...maleOfThirtyFive,
      birthDate: seventeenAndOldEnough,
      goal: "lose",
      ratePctPerWeek: 0.5,
    };

    expect(() => startingPlan(answers, TODAY, null)).toThrow(RangeError);
    expect(() => startingPlan(answers, TODAY, null)).toThrow(
      "A lose goal is not allowed under 18.",
    );
  });

  it("should not quote the birth date or the age in the message", () => {
    const answers: SetupAnswers = {
      ...maleOfThirtyFive,
      birthDate: seventeenAndOldEnough,
      goal: "lose",
      ratePctPerWeek: 0.5,
    };

    let message = "";
    try {
      startingPlan(answers, TODAY, null);
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).not.toContain("2009");
    expect(message).not.toContain("17");
  });

  it("should throw on the day before the 18th birthday", () => {
    expect(() =>
      startingPlan(
        {
          ...maleOfThirtyFive,
          birthDate: seventeenForOneMoreDay,
          goal: "lose",
          ratePctPerWeek: 0.5,
        },
        TODAY,
        null,
      ),
    ).toThrow(RangeError);
  });

  it("should accept lose on the 18th birthday", () => {
    expect(() =>
      startingPlan(
        { ...maleOfThirtyFive, birthDate: eighteenToday, goal: "lose", ratePctPerWeek: 0.5 },
        TODAY,
        null,
      ),
    ).not.toThrow();
  });

  it("should succeed for a person under 18 who chooses gain", () => {
    const plan = startingPlan(
      { ...maleOfThirtyFive, birthDate: seventeenAndOldEnough, goal: "gain", ratePctPerWeek: 0.25 },
      TODAY,
      null,
    );

    expect(plan.save.program.goal).toBe("gain");
  });

  it("should succeed for a person under 18 who chooses maintain", () => {
    expect(() =>
      startingPlan({ ...maleOfThirtyFive, birthDate: seventeenAndOldEnough }, TODAY, null),
    ).not.toThrow();
  });
});

describe("startingPlan save.profile", () => {
  it("should carry the stats, the targets and the chosen weight unit when none is stored", () => {
    const { save } = startingPlan({ ...maleOfThirtyFive, weightUnit: "lb" }, TODAY, null);

    expect(save.profile).toStrictEqual({
      sex: "male",
      birth_date: "1991-06-15",
      height_cm: 180,
      activity: "light",
      onboarding_weight_kg: 80,
      target_kcal: 2410,
      target_protein_g: 128,
      target_carbs_g: 286,
      target_fat_g: 84,
      weight_unit: "lb",
    });
  });

  it("should save kg when kg was chosen and none is stored", () => {
    expect(startingPlan(maleOfThirtyFive, TODAY, null).save.profile.weight_unit).toBe("kg");
  });

  it.each(["kg", "lb", "st"] as const)(
    "should carry no weight_unit key when %s is stored, whatever was chosen",
    (stored) => {
      for (const chosen of ["kg", "lb"] as const) {
        const { profile } = startingPlan(
          { ...maleOfThirtyFive, weightUnit: chosen },
          TODAY,
          stored,
        ).save;

        expect("weight_unit" in profile).toBe(false);
      }
    },
  );

  it("should carry only keys of the profile's update grant", () => {
    const updateGrant = [
      "sex",
      "birth_date",
      "height_cm",
      "activity",
      "weight_unit",
      "energy_unit",
      "timezone",
      "checkin_weekday",
      "onboarding_weight_kg",
      "onboarding_completed_at",
      "target_kcal",
      "target_protein_g",
      "target_carbs_g",
      "target_fat_g",
      "targets_updated_at",
    ];

    for (const stored of [null, "kg", "lb", "st"] as const) {
      for (const key of Object.keys(startingPlan(maleOfThirtyFive, TODAY, stored).save.profile)) {
        expect(updateGrant).toContain(key);
      }
    }
  });

  it("should leave the two timestamps to the repo", () => {
    const { profile } = startingPlan(maleOfThirtyFive, TODAY, null).save;

    expect("onboarding_completed_at" in profile).toBe(false);
    expect("targets_updated_at" in profile).toBe(false);
  });
});

describe("startingPlan save.program and save.weighIn", () => {
  it("should carry the program columns with the protein and fat values of the chosen presets", () => {
    const { save } = startingPlan(
      {
        ...maleOfThirtyFive,
        goal: "lose",
        ratePctPerWeek: 0.75,
        proteinPreset: "very_high",
        dietStyle: "low_carb",
      },
      TODAY,
      null,
    );

    expect(save.program).toStrictEqual({
      goal: "lose",
      rate_pct_per_week: 0.75,
      protein_g_per_kg: 2.2,
      fat_fraction_of_remaining: 0.6,
      split_preset: "low_carb",
      started_on: TODAY,
    });
  });

  it.each([
    ["balanced", 0.4],
    ["low_fat", 0.28],
    ["low_carb", 0.6],
  ] as const)("should store the %s style as it is with fat fraction %s", (dietStyle, fraction) => {
    const { program } = startingPlan({ ...maleOfThirtyFive, dietStyle }, TODAY, null).save;

    expect(program.split_preset).toBe(dietStyle);
    expect(program.fat_fraction_of_remaining).toBe(fraction);
  });

  it.each([
    ["moderate", 1.6],
    ["high", 2.0],
    ["very_high", 2.2],
  ] as const)("should store the %s protein preset as %s g per kg", (proteinPreset, gramsPerKg) => {
    const { program } = startingPlan({ ...maleOfThirtyFive, proteinPreset }, TODAY, null).save;

    expect(program.protein_g_per_kg).toBe(gramsPerKg);
  });

  it("should store the weigh-in of the entered weight on today", () => {
    expect(startingPlan(maleOfThirtyFive, TODAY, null).save.weighIn).toStrictEqual({
      weightKg: 80,
      localDate: TODAY,
    });
  });
});

describe("startingPlan params", () => {
  it("should use the params given for the targets and for the program row", () => {
    const params = {
      ...DEFAULT_ENGINE_PARAMS,
      targets: {
        ...DEFAULT_ENGINE_PARAMS.targets,
        proteinPresets: { ...DEFAULT_ENGINE_PARAMS.targets.proteinPresets, moderate: 1.8 },
      },
    };

    const plan = startingPlan(maleOfThirtyFive, TODAY, null, params);

    expect(plan.save.program.protein_g_per_kg).toBe(1.8);
    expect(plan.targets.proteinG).toBe(144);
  });
});

describe("startingPlan purity", () => {
  it("should give an equal result, and not the same object, for the same answers and day", () => {
    const first = startingPlan(femaleAtTheFloor, TODAY, "kg");
    const second = startingPlan(femaleAtTheFloor, TODAY, "kg");

    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
  });

  it("should not change the answers it is given", () => {
    const answers = { ...hugeAndVeryActive };
    startingPlan(answers, TODAY, null);

    expect(answers).toStrictEqual(hugeAndVeryActive);
  });
});
