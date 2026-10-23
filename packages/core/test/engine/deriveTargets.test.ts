import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  CALORIE_GOALS,
  CLAMPS,
  DEFAULT_ENGINE_PARAMS,
  deriveCalorieTarget,
  deriveTargets,
  initialExpenditure,
  splitMacros,
} from "../../src/engine";

import type { CalorieGoal, Clamp } from "../../src/engine";

describe("the CalorieGoal and Clamp lists", () => {
  it("should list the three goals", () => {
    expect(CALORIE_GOALS).toStrictEqual(["lose", "maintain", "gain"]);
  });

  it("should list the five engine clamps and not profile_max", () => {
    expect(CLAMPS).toStrictEqual(["max_rate", "max_deficit", "max_surplus", "floor", "macro_fit"]);
  });
});

describe("deriveCalorieTarget goldens from the Build Plan", () => {
  it("should give 2150 with no clamps for lose 0.5 at tdee 2579.54, 78.65 kg and BMR 1755", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 0.5,
      tdee: 2579.54,
      trendWeight: 78.65,
      bmr: 1755,
    });

    expect(result.caloriesKcal).toBe(2150);
    expect(result.clamps).toStrictEqual([]);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.4965, 4);
  });

  it("should give 1200 with max_deficit then floor for a woman of tdee 1700, 55 kg and BMR 1250 losing 1.0", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 1.0,
      tdee: 1700,
      trendWeight: 55,
      bmr: 1250,
    });

    expect(result.caloriesKcal).toBe(1200);
    expect(result.clamps).toStrictEqual(["max_deficit", "floor"]);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.826, 3);
  });

  it("should give 3010 for gain 0.25 at tdee 2800 and 75 kg", () => {
    const result = deriveCalorieTarget({
      goal: "gain",
      ratePctPerWeek: 0.25,
      tdee: 2800,
      trendWeight: 75,
      bmr: 1700,
    });

    expect(result.caloriesKcal).toBe(3010);
    expect(result.clamps).toStrictEqual([]);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.2545, 4);
  });

  it("should give 2410 for maintain at tdee 2413.1", () => {
    const result = deriveCalorieTarget({
      goal: "maintain",
      ratePctPerWeek: 0,
      tdee: 2413.1,
      trendWeight: 80,
      bmr: 1700,
    });

    expect(result.caloriesKcal).toBe(2410);
    expect(result.clamps).toStrictEqual([]);
    expect(result.effectiveRatePctPerWeek).toBe(0);
  });

  it("should treat lose 1.5 as 1.0 and record max_rate", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 1.5,
      tdee: 3000,
      trendWeight: 80,
      bmr: 1700,
    });

    expect(result.caloriesKcal).toBe(2120);
    expect(result.clamps).toStrictEqual(["max_rate"]);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(1.0, 6);
  });

  it("should record max_rate then max_deficit for lose 1.5 at the Build Plan's tdee 2579.54 and 78.65 kg", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 1.5,
      tdee: 2579.54,
      trendWeight: 78.65,
      bmr: 1755,
    });

    expect(result.caloriesKcal).toBe(1810);
    expect(result.clamps).toStrictEqual(["max_rate", "max_deficit"]);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.8895, 4);
  });
});

describe("deriveCalorieTarget rate clamp", () => {
  it("should treat gain 0.75 as 0.5 and record max_rate", () => {
    const result = deriveCalorieTarget({
      goal: "gain",
      ratePctPerWeek: 0.75,
      tdee: 3000,
      trendWeight: 80,
      bmr: 1700,
    });

    expect(result.caloriesKcal).toBe(3440);
    expect(result.clamps).toStrictEqual(["max_rate"]);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.5, 6);
  });

  it("should not record max_rate for lose 1.0 exactly", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 1.0,
      tdee: 3000,
      trendWeight: 80,
      bmr: 1700,
    });

    expect(result.caloriesKcal).toBe(2120);
    expect(result.clamps).toStrictEqual([]);
  });

  it("should ignore the rate and record nothing for maintain", () => {
    const result = deriveCalorieTarget({
      goal: "maintain",
      ratePctPerWeek: 1.5,
      tdee: 2413.1,
      trendWeight: 80,
      bmr: 1700,
    });

    expect(result.caloriesKcal).toBe(2410);
    expect(result.clamps).toStrictEqual([]);
    expect(result.effectiveRatePctPerWeek).toBe(0);
  });
});

describe("deriveCalorieTarget deficit and surplus caps", () => {
  it("should cut a deficit over 30% of tdee to 70% and record max_deficit", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 1.0,
      tdee: 2000,
      trendWeight: 90,
      bmr: 1500,
    });

    expect(result.caloriesKcal).toBe(1400);
    expect(result.clamps).toStrictEqual(["max_deficit"]);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.6061, 4);
  });

  it("should cut a surplus over 20% of tdee to 120% and record max_surplus", () => {
    const result = deriveCalorieTarget({
      goal: "gain",
      ratePctPerWeek: 0.5,
      tdee: 2000,
      trendWeight: 100,
      bmr: 1600,
    });

    expect(result.caloriesKcal).toBe(2400);
    expect(result.clamps).toStrictEqual(["max_surplus"]);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.3636, 4);
  });
});

describe("deriveCalorieTarget floor", () => {
  it("should raise a result below the floor of 1200 and record floor alone", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 0.75,
      tdee: 1500,
      trendWeight: 50,
      bmr: 1250,
    });

    expect(result.caloriesKcal).toBe(1200);
    expect(result.clamps).toStrictEqual(["floor"]);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.5455, 4);
  });

  it("should use 0.9 times the BMR when that is above 1200", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 0.75,
      tdee: 2000,
      trendWeight: 60,
      bmr: 1800,
    });

    expect(result.caloriesKcal).toBe(1620);
    expect(result.clamps).toStrictEqual(["floor"]);
  });

  it("should return 1240 for a floor of 1237.5 (BMR 1375), which nearest rounding reaches by itself", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 1.0,
      tdee: 1500,
      trendWeight: 80,
      bmr: 1375,
    });

    expect(result.caloriesKcal).toBe(1240);
    expect(result.clamps).toStrictEqual(["max_deficit", "floor"]);
  });

  it("should return 1240 and never 1230 for a floor of 1233.9 that rounds to 1230 (BMR 1371)", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 1.0,
      tdee: 1500,
      trendWeight: 80,
      bmr: 1371,
    });

    expect(result.caloriesKcal).toBe(1240);
    expect(result.clamps).toStrictEqual(["max_deficit", "floor"]);
  });

  it("should step up to 1240 and record nothing when raw 1234.9 is above the floor of 1233.9 but rounds to 1230", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 0.241,
      tdee: 1500,
      trendWeight: 100,
      bmr: 1371,
    });

    expect(result.caloriesKcal).toBe(1240);
    expect(result.clamps).toStrictEqual([]);
  });

  it("should let the floor win over tdee for the Amendment's woman of 50, 150 cm and 40 kg", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 0.5,
      tdee: 1111.8,
      trendWeight: 40,
      bmr: 926.5,
    });

    expect(result.caloriesKcal).toBe(1200);
    expect(result.clamps).toStrictEqual(["floor"]);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(-0.2, 3);
  });

  it("should reach the same floor-above-tdee result from initialExpenditure of that woman", () => {
    const { bmrKcal, muKcal } = initialExpenditure({
      sex: "female",
      ageYears: 50,
      heightCm: 150,
      weightKg: 40,
      activity: "sedentary",
    });

    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 0.5,
      tdee: muKcal,
      trendWeight: 40,
      bmr: bmrKcal,
    });

    expect(result.caloriesKcal).toBe(1200);
    expect(result.clamps).toStrictEqual(["floor"]);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(-0.2, 3);
  });

  it("should record max_deficit then floor when both bite and the floor is above tdee", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 1.0,
      tdee: 1111.8,
      trendWeight: 40,
      bmr: 926.5,
    });

    expect(result.caloriesKcal).toBe(1200);
    expect(result.clamps).toStrictEqual(["max_deficit", "floor"]);
  });

  it("should not apply the floor to maintain", () => {
    const result = deriveCalorieTarget({
      goal: "maintain",
      ratePctPerWeek: 0,
      tdee: 1000,
      trendWeight: 60,
      bmr: 1500,
    });

    expect(result.caloriesKcal).toBe(1000);
    expect(result.clamps).toStrictEqual([]);
  });

  it("should not apply the floor to gain", () => {
    const result = deriveCalorieTarget({
      goal: "gain",
      ratePctPerWeek: 0.25,
      tdee: 1000,
      trendWeight: 60,
      bmr: 1500,
    });

    expect(result.caloriesKcal).toBe(1170);
    expect(result.clamps).toStrictEqual([]);
  });
});

describe("deriveCalorieTarget rounding never breaks a bound", () => {
  it("should return 1410 with max_deficit and never 1400 when 70% of tdee is 1403.5", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 1.0,
      tdee: 2005,
      trendWeight: 100,
      bmr: 1400,
    });

    expect(result.caloriesKcal).toBe(1410);
    expect(result.clamps).toStrictEqual(["max_deficit"]);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.5409, 4);
  });

  it("should return 2400 with max_surplus and never 2410 when 120% of tdee is 2406", () => {
    const result = deriveCalorieTarget({
      goal: "gain",
      ratePctPerWeek: 0.5,
      tdee: 2005,
      trendWeight: 100,
      bmr: 1500,
    });

    expect(result.caloriesKcal).toBe(2400);
    expect(result.clamps).toStrictEqual(["max_surplus"]);
  });

  it("should step up to 1410 and record nothing when raw 1403.63 is above the bound of 1403.5 but rounds to 1400", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 0.5467,
      tdee: 2005,
      trendWeight: 100,
      bmr: 1000,
    });

    expect(result.caloriesKcal).toBe(1410);
    expect(result.clamps).toStrictEqual([]);
  });

  it("should record nothing when raw lands exactly on 70% of tdee (1540 of 2200)", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 1.0,
      tdee: 2200,
      trendWeight: 60,
      bmr: 1000,
    });

    expect(result.caloriesKcal).toBe(1540);
    expect(result.clamps).toStrictEqual([]);
  });

  it("should record nothing when raw lands exactly on 120% of tdee (1980 of 1650)", () => {
    const result = deriveCalorieTarget({
      goal: "gain",
      ratePctPerWeek: 0.5,
      tdee: 1650,
      trendWeight: 60,
      bmr: 1000,
    });

    expect(result.caloriesKcal).toBe(1980);
    expect(result.clamps).toStrictEqual([]);
  });

  it("should record nothing when raw lands exactly on the floor of 1200", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 1.0,
      tdee: 1640,
      trendWeight: 40,
      bmr: 1000,
    });

    expect(result.caloriesKcal).toBe(1200);
    expect(result.clamps).toStrictEqual([]);
  });

  it("should step down to 2400 and record nothing when raw 2405.07 is under the bound of 2406 but rounds to 2410", () => {
    const result = deriveCalorieTarget({
      goal: "gain",
      ratePctPerWeek: 0.3637,
      tdee: 2005,
      trendWeight: 100,
      bmr: 1500,
    });

    expect(result.caloriesKcal).toBe(2400);
    expect(result.clamps).toStrictEqual([]);
  });

  it("should round halves up to the next 10", () => {
    const result = deriveCalorieTarget({
      goal: "maintain",
      ratePctPerWeek: 0,
      tdee: 2415,
      trendWeight: 80,
      bmr: 1700,
    });

    expect(result.caloriesKcal).toBe(2420);
  });
});

describe("deriveCalorieTarget effective rate", () => {
  it("should be positive when a lose result sits below tdee", () => {
    const result = deriveCalorieTarget({
      goal: "lose",
      ratePctPerWeek: 0.5,
      tdee: 3000,
      trendWeight: 80,
      bmr: 1700,
    });

    expect(result.caloriesKcal).toBe(2560);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.5, 6);
  });

  it("should be positive when a gain result sits above tdee", () => {
    const result = deriveCalorieTarget({
      goal: "gain",
      ratePctPerWeek: 0.25,
      tdee: 3000,
      trendWeight: 80,
      bmr: 1700,
    });

    expect(result.caloriesKcal).toBe(3220);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.25, 6);
  });
});

describe("deriveCalorieTarget params", () => {
  it("should read the floor from the targets params", () => {
    const result = deriveCalorieTarget(
      { goal: "lose", ratePctPerWeek: 1.0, tdee: 1700, trendWeight: 55, bmr: 1250 },
      {
        ...DEFAULT_ENGINE_PARAMS,
        targets: { ...DEFAULT_ENGINE_PARAMS.targets, floorAbsKcal: 1500 },
      },
    );

    expect(result.caloriesKcal).toBe(1500);
    expect(result.clamps).toStrictEqual(["max_deficit", "floor"]);
  });

  it("should read the energy density from the expenditure params and nowhere else", () => {
    const result = deriveCalorieTarget(
      { goal: "lose", ratePctPerWeek: 0.5, tdee: 3000, trendWeight: 80, bmr: 1700 },
      {
        ...DEFAULT_ENGINE_PARAMS,
        expenditure: { ...DEFAULT_ENGINE_PARAMS.expenditure, energyDensityKcalPerKg: 7000 },
      },
    );

    expect(result.caloriesKcal).toBe(2600);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.5, 6);
  });
});

// Float hygiene only: a result within this of a limit counts as on it. It is not a rounding allowance.
const FLOAT_NOISE = 1e-9;

const goalArbitrary = fc.constantFrom<CalorieGoal>(...CALORIE_GOALS);

const inputArbitrary = fc.record({
  goal: goalArbitrary,
  ratePctPerWeek: fc.double({ min: 0, max: 2, noNaN: true }),
  tdee: fc.double({ min: 800, max: 6000, noNaN: true }),
  trendWeight: fc.double({ min: 30, max: 250, noNaN: true }),
  bmr: fc.double({ min: 800, max: 3000, noNaN: true }),
});

// The caps of the engine, written out here so the properties do not read them from the module under test.
function requestedRate(goal: CalorieGoal, ratePctPerWeek: number): number {
  if (goal === "lose") return Math.min(ratePctPerWeek, 1.0);
  if (goal === "gain") return Math.min(ratePctPerWeek, 0.5);
  return 0;
}

describe("deriveCalorieTarget properties", () => {
  it("should always return a multiple of 10", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        expect(deriveCalorieTarget(input).caloriesKcal % 10).toBe(0);
      }),
    );
  });

  it("should never put lose below the floor of max(1200, 0.9 times BMR)", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        fc.pre(input.goal === "lose");
        const floor = Math.max(1200, 0.9 * input.bmr);

        expect(deriveCalorieTarget(input).caloriesKcal).toBeGreaterThanOrEqual(floor);
      }),
    );
  });

  it("should never put lose above max(tdee, floor) once both are taken to a multiple of 10", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        fc.pre(input.goal === "lose");
        const floor = Math.max(1200, 0.9 * input.bmr);
        const ceiling = Math.max(Math.round(input.tdee / 10) * 10, Math.ceil(floor / 10) * 10);

        expect(deriveCalorieTarget(input).caloriesKcal).toBeLessThanOrEqual(ceiling);
      }),
    );
  });

  it("should never put gain below tdee taken to a multiple of 10", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        fc.pre(input.goal === "gain");

        expect(deriveCalorieTarget(input).caloriesKcal).toBeGreaterThanOrEqual(
          Math.round(input.tdee / 10) * 10,
        );
      }),
    );
  });

  it("should never put maintain anywhere but tdee taken to a multiple of 10", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        fc.pre(input.goal === "maintain");

        expect(deriveCalorieTarget(input).caloriesKcal).toBe(Math.round(input.tdee / 10) * 10);
      }),
    );
  });

  it("should never put lose below 70% of tdee", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        fc.pre(input.goal === "lose");

        expect(deriveCalorieTarget(input).caloriesKcal).toBeGreaterThanOrEqual(0.7 * input.tdee);
      }),
    );
  });

  it("should never put gain above 120% of tdee", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        fc.pre(input.goal === "gain");

        expect(deriveCalorieTarget(input).caloriesKcal).toBeLessThanOrEqual(1.2 * input.tdee);
      }),
    );
  });

  it("should never report an effective rate above the clamped rate by more than half a step of 10 kcal", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        const halfStepPercent = (5 / ((input.trendWeight * 7700) / 7)) * 100;

        expect(deriveCalorieTarget(input).effectiveRatePctPerWeek).toBeLessThanOrEqual(
          requestedRate(input.goal, input.ratePctPerWeek) + halfStepPercent + FLOAT_NOISE,
        );
      }),
    );
  });

  it("should never report an effective rate above the clamped rate once a cap or the floor bit", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        const result = deriveCalorieTarget(input);
        fc.pre(
          result.clamps.some(
            (clamp) => clamp === "max_deficit" || clamp === "max_surplus" || clamp === "floor",
          ),
        );

        expect(result.effectiveRatePctPerWeek).toBeLessThanOrEqual(
          requestedRate(input.goal, input.ratePctPerWeek) + FLOAT_NOISE,
        );
      }),
    );
  });

  it("should record max_rate exactly when lose or gain asks for more than the cap", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        const cap = input.goal === "lose" ? 1.0 : 0.5;
        const asksForMore = input.goal !== "maintain" && input.ratePctPerWeek > cap;

        expect(deriveCalorieTarget(input).clamps.includes("max_rate")).toBe(asksForMore);
      }),
    );
  });

  it("should record only the clamps that belong to the goal, each at most once", () => {
    const allowed: Record<CalorieGoal, readonly Clamp[]> = {
      lose: ["max_rate", "max_deficit", "floor"],
      gain: ["max_rate", "max_surplus"],
      maintain: [],
    };

    fc.assert(
      fc.property(inputArbitrary, (input) => {
        const { clamps } = deriveCalorieTarget(input);

        expect(new Set(clamps).size).toBe(clamps.length);
        for (const clamp of clamps) {
          expect(allowed[input.goal]).toContain(clamp);
        }
      }),
    );
  });
});

// A fixed input for the preset tests: 2100 kcal at 80 kg. Every expected value below is worked by hand
// from the Build Plan's rules, never read back from the module.
const presetInput = { caloriesKcal: 2100, trendWeight: 80, proteinGPerKg: 1.6, fatFraction: 0.4 };

describe("splitMacros golden from the Build Plan", () => {
  it("should give P 126, F 73 and C 247 for 2150 kcal at 78.65 kg, protein 1.6 and fat 0.40", () => {
    const result = splitMacros({
      caloriesKcal: 2150,
      trendWeight: 78.65,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
    });

    expect(result).toStrictEqual({ proteinG: 126, fatG: 73, carbsG: 247, clamps: [] });
  });

  it("should take the fat share from the rounded protein, not the unrounded one", () => {
    // 2000 kcal at 61 kg, protein 1.6: 97.6 g rounds to P 98. F = round(0.4 x (2000 - 392) / 9) = round(71.47) = 71.
    // The unrounded 97.6 g would leave 1609.6 kcal and give round(71.54) = 72.
    // C = round((2000 - 392 - 639) / 4) = round(242.25) = 242.
    const result = splitMacros({
      caloriesKcal: 2000,
      trendWeight: 61,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
    });

    expect(result).toStrictEqual({ proteinG: 98, fatG: 71, carbsG: 242, clamps: [] });
  });
});

describe("splitMacros presets", () => {
  it("should give P 128, F 71 and C 237 for the moderate protein preset of 1.6", () => {
    expect(splitMacros({ ...presetInput, proteinGPerKg: 1.6 })).toStrictEqual({
      proteinG: 128,
      fatG: 71,
      carbsG: 237,
      clamps: [],
    });
  });

  it("should give P 160, F 65 and C 219 for the high protein preset of 2.0", () => {
    expect(splitMacros({ ...presetInput, proteinGPerKg: 2.0 })).toStrictEqual({
      proteinG: 160,
      fatG: 65,
      carbsG: 219,
      clamps: [],
    });
  });

  it("should give P 176, F 62 and C 210 for the very high protein preset of 2.2", () => {
    expect(splitMacros({ ...presetInput, proteinGPerKg: 2.2 })).toStrictEqual({
      proteinG: 176,
      fatG: 62,
      carbsG: 210,
      clamps: [],
    });
  });

  it("should give F 71 and C 237 for the balanced fat fraction of 0.40", () => {
    expect(splitMacros({ ...presetInput, fatFraction: 0.4 })).toStrictEqual({
      proteinG: 128,
      fatG: 71,
      carbsG: 237,
      clamps: [],
    });
  });

  it("should give F 49 and C 287 for the low fat fraction of 0.28", () => {
    expect(splitMacros({ ...presetInput, fatFraction: 0.28 })).toStrictEqual({
      proteinG: 128,
      fatG: 49,
      carbsG: 287,
      clamps: [],
    });
  });

  it("should give F 106 and C 159 for the low carb fat fraction of 0.60", () => {
    expect(splitMacros({ ...presetInput, fatFraction: 0.6 })).toStrictEqual({
      proteinG: 128,
      fatG: 106,
      carbsG: 159,
      clamps: [],
    });
  });
});

describe("splitMacros protein cap", () => {
  it("should treat 3.5 g/kg as 3.0 and give P 240 at 80 kg", () => {
    expect(splitMacros({ ...presetInput, proteinGPerKg: 3.5 })).toStrictEqual({
      proteinG: 240,
      fatG: 51,
      carbsG: 170,
      clamps: [],
    });
  });

  it("should leave 3.0 g/kg exactly as it is", () => {
    expect(splitMacros({ ...presetInput, proteinGPerKg: 3.0 }).proteinG).toBe(240);
  });

  it("should read the cap from the params", () => {
    const result = splitMacros(
      { ...presetInput, proteinGPerKg: 2.5 },
      {
        ...DEFAULT_ENGINE_PARAMS,
        targets: { ...DEFAULT_ENGINE_PARAMS.targets, proteinMaxGPerKg: 2.0 },
      },
    );

    expect(result.proteinG).toBe(160);
  });
});

describe("splitMacros fat floor", () => {
  it("should give 0.5 g/kg of fat, 45 g at 90 kg, when a low fat split at 1400 kcal falls below it", () => {
    // 0.28 x (1400 - 4 x 144) / 9 is 25.6 g, under the floor of 0.5 x 90 = 45 g.
    expect(
      splitMacros({
        caloriesKcal: 1400,
        trendWeight: 90,
        proteinGPerKg: 1.6,
        fatFraction: 0.28,
      }),
    ).toStrictEqual({ proteinG: 144, fatG: 45, carbsG: 105, clamps: [] });
  });

  it("should read the floor from the params", () => {
    const result = splitMacros(
      { caloriesKcal: 1400, trendWeight: 90, proteinGPerKg: 1.6, fatFraction: 0.28 },
      {
        ...DEFAULT_ENGINE_PARAMS,
        targets: { ...DEFAULT_ENGINE_PARAMS.targets, fatMinGPerKg: 0.8 },
      },
    );

    expect(result).toStrictEqual({ proteinG: 144, fatG: 72, carbsG: 44, clamps: [] });
  });
});

// The fit tests compare against the whole grams the split will emit, so the fat floor is rounded before the comparison.
describe("splitMacros when the protein and the fat floor do not fit", () => {
  it("should give C 0, F 60 and P 165 with macro_fit for 1200 kcal at 120 kg and protein 2.2", () => {
    // Protein 2.2 x 120 = 264 g is 1056 kcal and the fat floor 0.5 x 120 = 60 g is 540 kcal, over 1200.
    // Protein is cut to what fits after the fat floor: (1200 - 540) / 4 = 165.
    expect(
      splitMacros({
        caloriesKcal: 1200,
        trendWeight: 120,
        proteinGPerKg: 2.2,
        fatFraction: 0.4,
      }),
    ).toStrictEqual({ proteinG: 165, fatG: 60, carbsG: 0, clamps: ["macro_fit"] });
  });

  it("should record no macro_fit when protein and the fat floor fit exactly", () => {
    // 100 kg: P 160 g is 640 kcal and the floor of 50 g is 450 kcal, 1090 in all.
    expect(
      splitMacros({ caloriesKcal: 1090, trendWeight: 100, proteinGPerKg: 1.6, fatFraction: 0.4 }),
    ).toStrictEqual({ proteinG: 160, fatG: 50, carbsG: 0, clamps: [] });
  });

  it("should record macro_fit and cut protein by one gram when they miss by one kcal", () => {
    expect(
      splitMacros({ caloriesKcal: 1089, trendWeight: 100, proteinGPerKg: 1.6, fatFraction: 0.4 }),
    ).toStrictEqual({ proteinG: 159, fatG: 50, carbsG: 0, clamps: ["macro_fit"] });
  });

  it("should give F 133, P 0 and C 0 with macro_fit for 1200 kcal at 300 kg, where the fat floor alone is over", () => {
    // The floor of 0.5 x 300 = 150 g is 1350 kcal. Fat is floor(1200 / 9) = 133 g, so the macros stay under the calories.
    expect(
      splitMacros({
        caloriesKcal: 1200,
        trendWeight: 300,
        proteinGPerKg: 1.6,
        fatFraction: 0.4,
      }),
    ).toStrictEqual({ proteinG: 0, fatG: 133, carbsG: 0, clamps: ["macro_fit"] });
  });

  it("should keep the fat floor and give P 0 when the floor fills the calories exactly", () => {
    // 100 kg and 450 kcal: the floor of 50 g is exactly 450 kcal.
    expect(
      splitMacros({ caloriesKcal: 450, trendWeight: 100, proteinGPerKg: 1.6, fatFraction: 0.4 }),
    ).toStrictEqual({ proteinG: 0, fatG: 50, carbsG: 0, clamps: ["macro_fit"] });
  });

  it("should give F 49 when the fat floor of 50 g is one kcal over 449 kcal", () => {
    expect(
      splitMacros({ caloriesKcal: 449, trendWeight: 100, proteinGPerKg: 1.6, fatFraction: 0.4 }),
    ).toStrictEqual({ proteinG: 0, fatG: 49, carbsG: 0, clamps: ["macro_fit"] });
  });

  it("should go to the fat-floor-alone case at 457 kcal and 101 kg, where the floor of 50.5 g rounds up to 51 g (459 kcal)", () => {
    expect(
      splitMacros({ caloriesKcal: 457, trendWeight: 101, proteinGPerKg: 1.6, fatFraction: 0.4 }),
    ).toStrictEqual({ proteinG: 0, fatG: 50, carbsG: 0, clamps: ["macro_fit"] });
  });

  it("should keep the rounded floor of 51 g and P 0 at 459 kcal and 101 kg, where it fills the calories exactly", () => {
    expect(
      splitMacros({ caloriesKcal: 459, trendWeight: 101, proteinGPerKg: 1.6, fatFraction: 0.4 }),
    ).toStrictEqual({ proteinG: 0, fatG: 51, carbsG: 0, clamps: ["macro_fit"] });
  });
});

describe("deriveTargets goldens from the Build Plan", () => {
  it("should give 2150 kcal, P 126, F 73 and C 247 for lose 0.5 at tdee 2579.54, 78.65 kg and BMR 1755", () => {
    const result = deriveTargets({
      config: { goal: "lose", ratePctPerWeek: 0.5, proteinGPerKg: 1.6, fatFraction: 0.4 },
      tdee: 2579.54,
      trendWeight: 78.65,
      bmr: 1755,
    });

    expect(result.caloriesKcal).toBe(2150);
    expect(result.proteinG).toBe(126);
    expect(result.fatG).toBe(73);
    expect(result.carbsG).toBe(247);
    expect(result.clamps).toStrictEqual([]);
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.4965, 4);
    expect(result.engineVersion).toBe("keylow-engine-v1");
  });

  it("should give 1200 kcal, P 88, F 38 and C 127 with max_deficit then floor for the woman of 55 kg", () => {
    const result = deriveTargets({
      config: { goal: "lose", ratePctPerWeek: 1.0, proteinGPerKg: 1.6, fatFraction: 0.4 },
      tdee: 1700,
      trendWeight: 55,
      bmr: 1250,
    });

    expect(result).toMatchObject({
      caloriesKcal: 1200,
      proteinG: 88,
      fatG: 38,
      carbsG: 127,
      clamps: ["max_deficit", "floor"],
    });
    expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.826, 3);
  });

  it("should give 3010 kcal, P 150, F 107 and C 362 for gain 0.25 at tdee 2800 and 75 kg with protein 2.0", () => {
    const result = deriveTargets({
      config: { goal: "gain", ratePctPerWeek: 0.25, proteinGPerKg: 2.0, fatFraction: 0.4 },
      tdee: 2800,
      trendWeight: 75,
      bmr: 1700,
    });

    expect(result).toMatchObject({
      caloriesKcal: 3010,
      proteinG: 150,
      fatG: 107,
      carbsG: 362,
      clamps: [],
    });
  });

  it("should give 2410 kcal, P 160, F 79 and C 265 for maintain at tdee 2413.1 and 80 kg with protein 2.0", () => {
    const result = deriveTargets({
      config: { goal: "maintain", ratePctPerWeek: 0, proteinGPerKg: 2.0, fatFraction: 0.4 },
      tdee: 2413.1,
      trendWeight: 80,
      bmr: 1700,
    });

    expect(result).toMatchObject({
      caloriesKcal: 2410,
      proteinG: 160,
      fatG: 79,
      carbsG: 265,
      clamps: [],
      effectiveRatePctPerWeek: 0,
    });
  });

  it("should give 2120 kcal, P 128, F 71 and C 242 with max_rate for lose 1.5 at tdee 3000 and 80 kg", () => {
    const result = deriveTargets({
      config: { goal: "lose", ratePctPerWeek: 1.5, proteinGPerKg: 1.6, fatFraction: 0.4 },
      tdee: 3000,
      trendWeight: 80,
      bmr: 1700,
    });

    expect(result).toMatchObject({
      caloriesKcal: 2120,
      proteinG: 128,
      fatG: 71,
      carbsG: 242,
      clamps: ["max_rate"],
    });
  });

  it("should give 1810 kcal, P 126, F 58 and C 196 with max_rate then max_deficit at the Build Plan's tdee and weight", () => {
    const result = deriveTargets({
      config: { goal: "lose", ratePctPerWeek: 1.5, proteinGPerKg: 1.6, fatFraction: 0.4 },
      tdee: 2579.54,
      trendWeight: 78.65,
      bmr: 1755,
    });

    expect(result).toMatchObject({
      caloriesKcal: 1810,
      proteinG: 126,
      fatG: 58,
      carbsG: 196,
      clamps: ["max_rate", "max_deficit"],
    });
  });
});

describe("deriveTargets clamp order", () => {
  it("should list max_deficit, floor and macro_fit for a lose goal at 300 kg, where the fat floor alone is over the calories", () => {
    // tdee 1700 at 300 kg: a 1.0% loss is 3300 kcal a day, which takes the target below zero. The rate is at the
    // cap, not over it, so no max_rate. The 30% deficit cap (1190) applies, then the floor max(1200, 0.9 x 1250) = 1200.
    // The fat floor 0.5 x 300 = 150 g is 1350 kcal, so fat is floor(1200 / 9) = 133 g and protein and carbs are 0.
    const result = deriveTargets({
      config: { goal: "lose", ratePctPerWeek: 1.0, proteinGPerKg: 1.6, fatFraction: 0.4 },
      tdee: 1700,
      trendWeight: 300,
      bmr: 1250,
    });

    expect(result).toMatchObject({
      caloriesKcal: 1200,
      proteinG: 0,
      fatG: 133,
      carbsG: 0,
      clamps: ["max_deficit", "floor", "macro_fit"],
    });
  });

  it("should list the calorie clamps first and macro_fit last", () => {
    // tdee 1700 at 120 kg: a 1.0% loss is 1320 kcal a day, cut to the 30% deficit (1190), then lifted to the floor of 1200.
    // At 1200 kcal, protein 2.2 x 120 = 264 g and the fat floor of 60 g do not fit.
    const result = deriveTargets({
      config: { goal: "lose", ratePctPerWeek: 1.0, proteinGPerKg: 2.2, fatFraction: 0.4 },
      tdee: 1700,
      trendWeight: 120,
      bmr: 1250,
    });

    expect(result).toMatchObject({
      caloriesKcal: 1200,
      proteinG: 165,
      fatG: 60,
      carbsG: 0,
      clamps: ["max_deficit", "floor", "macro_fit"],
    });
  });

  it("should record macro_fit alone when no calorie clamp bites", () => {
    // maintain at 1200 kcal and 120 kg, protein 2.2.
    const result = deriveTargets({
      config: { goal: "maintain", ratePctPerWeek: 0, proteinGPerKg: 2.2, fatFraction: 0.4 },
      tdee: 1200,
      trendWeight: 120,
      bmr: 1000,
    });

    expect(result).toMatchObject({ caloriesKcal: 1200, proteinG: 165, clamps: ["macro_fit"] });
  });
});

describe("deriveTargets params", () => {
  it("should carry the engine version of the params it was given", () => {
    const result = deriveTargets(
      {
        config: { goal: "maintain", ratePctPerWeek: 0, proteinGPerKg: 1.6, fatFraction: 0.4 },
        tdee: 2000,
        trendWeight: 80,
        bmr: 1700,
      },
      DEFAULT_ENGINE_PARAMS,
    );

    expect(result.engineVersion).toBe("keylow-engine-v1");
  });
});

const macroInputArbitrary = fc.record({
  caloriesKcal: fc.integer({ min: 800, max: 6000 }),
  trendWeight: fc.double({ min: 20, max: 400, noNaN: true }),
  proteinGPerKg: fc.double({ min: 0.5, max: 4, noNaN: true }),
  fatFraction: fc.constantFrom(0.4, 0.28, 0.6),
});

describe("splitMacros properties", () => {
  // The fat-floor-alone case is left out: fat is floor(calories / 9), so it can be up to 8 kcal under.
  it("should stay within 6 kcal of the calories unless the fat floor alone is over them", () => {
    fc.assert(
      fc.property(macroInputArbitrary, (input) => {
        const { proteinG, fatG, carbsG } = splitMacros(input);
        fc.pre(9 * Math.round(0.5 * input.trendWeight) <= input.caloriesKcal);

        expect(
          Math.abs(4 * proteinG + 9 * fatG + 4 * carbsG - input.caloriesKcal),
        ).toBeLessThanOrEqual(6);
      }),
    );
  });

  it("should never exceed the calories by more than 6 kcal", () => {
    fc.assert(
      fc.property(macroInputArbitrary, (input) => {
        const { proteinG, fatG, carbsG } = splitMacros(input);

        expect(4 * proteinG + 9 * fatG + 4 * carbsG).toBeLessThanOrEqual(input.caloriesKcal + 6);
      }),
    );
  });

  it("should never give a negative macro", () => {
    fc.assert(
      fc.property(macroInputArbitrary, (input) => {
        const { proteinG, fatG, carbsG } = splitMacros(input);

        expect(proteinG).toBeGreaterThanOrEqual(0);
        expect(fatG).toBeGreaterThanOrEqual(0);
        expect(carbsG).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("should give whole grams", () => {
    fc.assert(
      fc.property(macroInputArbitrary, (input) => {
        const { proteinG, fatG, carbsG } = splitMacros(input);

        expect(Number.isInteger(proteinG)).toBe(true);
        expect(Number.isInteger(fatG)).toBe(true);
        expect(Number.isInteger(carbsG)).toBe(true);
      }),
    );
  });

  it("should never put protein above 3.0 g/kg, to the nearest gram", () => {
    fc.assert(
      fc.property(macroInputArbitrary, (input) => {
        expect(splitMacros(input).proteinG).toBeLessThanOrEqual(3.0 * input.trendWeight + 0.5);
      }),
    );
  });

  it("should give 0 carbs and no more than the floor of fat whenever macro_fit is recorded", () => {
    fc.assert(
      fc.property(macroInputArbitrary, (input) => {
        const { fatG, carbsG, clamps } = splitMacros(input);
        fc.pre(clamps.includes("macro_fit"));

        expect(carbsG).toBe(0);
        expect(fatG).toBeLessThanOrEqual(Math.max(0.5 * input.trendWeight + 0.5, 0));
      }),
    );
  });

  it("should never go over the calories by more than 6 kcal for every whole weight from 20 to 400 kg", () => {
    for (const caloriesKcal of [800, 1200, 2000, 6000]) {
      for (let trendWeight = 20; trendWeight <= 400; trendWeight += 1) {
        for (const proteinGPerKg of [1.6, 2.2, 3.0]) {
          for (const fatFraction of [0.28, 0.6]) {
            const { proteinG, fatG, carbsG } = splitMacros({
              caloriesKcal,
              trendWeight,
              proteinGPerKg,
              fatFraction,
            });

            expect(4 * proteinG + 9 * fatG + 4 * carbsG).toBeLessThanOrEqual(caloriesKcal + 6);
          }
        }
      }
    }
  });
});

describe("deriveTargets properties", () => {
  it("should match the calorie half and keep the macros inside the calories", () => {
    fc.assert(
      fc.property(
        inputArbitrary,
        fc.double({ min: 1, max: 3.5, noNaN: true }),
        fc.constantFrom(0.4, 0.28, 0.6),
        (input, proteinGPerKg, fatFraction) => {
          const result = deriveTargets({
            config: {
              goal: input.goal,
              ratePctPerWeek: input.ratePctPerWeek,
              proteinGPerKg,
              fatFraction,
            },
            tdee: input.tdee,
            trendWeight: input.trendWeight,
            bmr: input.bmr,
          });
          const calorieTarget = deriveCalorieTarget(input);

          expect(result.caloriesKcal).toBe(calorieTarget.caloriesKcal);
          expect(result.effectiveRatePctPerWeek).toBe(calorieTarget.effectiveRatePctPerWeek);
          expect(result.clamps.slice(0, calorieTarget.clamps.length)).toStrictEqual(
            calorieTarget.clamps,
          );
          expect(4 * result.proteinG + 9 * result.fatG + 4 * result.carbsG).toBeLessThanOrEqual(
            result.caloriesKcal + 6,
          );
        },
      ),
    );
  });
});
