import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  CALORIE_GOALS,
  CLAMPS,
  DEFAULT_ENGINE_PARAMS,
  calorieFloorKcal,
  deriveCalorieTarget,
  deriveTargets,
  effectiveRatePctPerWeek,
  initialExpenditure,
  splitMacros,
  toDayOfWeekKcal,
} from "../../src/engine";

import type { CalorieGoal, Clamp, DayOfWeekKcal } from "../../src/engine";

describe("calorieFloorKcal", () => {
  it("should be 90 percent of the BMR when that is above 1,200 kcal: 1,579.5 for the golden BMR of 1,755", () => {
    expect(calorieFloorKcal(1755, DEFAULT_ENGINE_PARAMS)).toBe(1579.5);
  });

  it("should be 1,200 kcal when 90 percent of the BMR is below it", () => {
    expect(calorieFloorKcal(926.5, DEFAULT_ENGINE_PARAMS)).toBe(1200);
  });
});

describe("the CalorieGoal and Clamp lists", () => {
  it("should list the three goals", () => {
    expect(CALORIE_GOALS).toStrictEqual(["lose", "maintain", "gain"]);
  });

  it("should list the seven engine clamps and not profile_max", () => {
    expect(CLAMPS).toStrictEqual([
      "max_rate",
      "max_deficit",
      "max_surplus",
      "floor",
      "macro_fit",
      "dow_floor",
      "dow_range",
    ]);
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

describe("effectiveRatePctPerWeek", () => {
  it("should give 0.4965 for a loss from 2579.54 to 2150 kcal at 78.65 kg", () => {
    expect(
      effectiveRatePctPerWeek({
        goal: "lose",
        caloriesKcal: 2150,
        tdee: 2579.54,
        trendWeight: 78.65,
      }),
    ).toBeCloseTo(0.4965, 4);
  });

  it("should give 0.1827 for a gain from 5638.25 to 6000 kcal at 180 kg", () => {
    expect(
      effectiveRatePctPerWeek({
        goal: "gain",
        caloriesKcal: 6000,
        tdee: 5638.25,
        trendWeight: 180,
      }),
    ).toBeCloseTo(0.1827, 4);
  });

  it("should be negative when a lose target sits above tdee", () => {
    expect(
      effectiveRatePctPerWeek({
        goal: "lose",
        caloriesKcal: 1200,
        tdee: 1111.8,
        trendWeight: 40,
      }),
    ).toBeCloseTo(-0.2005, 4);
  });

  it("should give 0 at maintain whatever the calories", () => {
    expect(
      effectiveRatePctPerWeek({
        goal: "maintain",
        caloriesKcal: 2500,
        tdee: 2413.125,
        trendWeight: 80,
      }),
    ).toBe(0);
  });

  it("should read the energy density from the params", () => {
    const params = {
      ...DEFAULT_ENGINE_PARAMS,
      expenditure: { ...DEFAULT_ENGINE_PARAMS.expenditure, energyDensityKcalPerKg: 3850 },
    };

    expect(
      effectiveRatePctPerWeek(
        { goal: "gain", caloriesKcal: 6000, tdee: 5638.25, trendWeight: 180 },
        params,
      ),
    ).toBeCloseTo(0.3654, 4);
  });
});

describe("deriveTargets day of week offsets", () => {
  const loseGolden = {
    goal: "lose",
    ratePctPerWeek: 0.5,
    proteinGPerKg: 1.6,
    fatFraction: 0.4,
  } as const;

  // The woman of 55 kg: the week is 1200 after max_deficit and the floor, and the floor is 1200.
  const womanFloor = {
    config: { goal: "lose", ratePctPerWeek: 1.0, proteinGPerKg: 1.6, fatFraction: 0.4 },
    tdee: 1700,
    trendWeight: 55,
    bmr: 1250,
  } as const;

  describe("with no offsets", () => {
    it("should give seven copies of 2150 for the lose golden when no offsets are passed", () => {
      const result = deriveTargets({
        config: loseGolden,
        tdee: 2579.54,
        trendWeight: 78.65,
        bmr: 1755,
      });

      expect(result.dowCaloriesKcal).toStrictEqual([2150, 2150, 2150, 2150, 2150, 2150, 2150]);
    });

    it("should give seven copies of 2150 for the lose golden when the offsets are all zeros", () => {
      const result = deriveTargets({
        config: { ...loseGolden, dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0] },
        tdee: 2579.54,
        trendWeight: 78.65,
        bmr: 1755,
      });

      expect(result.dowCaloriesKcal).toStrictEqual([2150, 2150, 2150, 2150, 2150, 2150, 2150]);
      expect(result.clamps).toStrictEqual([]);
    });

    it("should give seven copies of 1200 for the woman of 55 kg and record no day clamp", () => {
      const result = deriveTargets(womanFloor);

      expect(result.dowCaloriesKcal).toStrictEqual([1200, 1200, 1200, 1200, 1200, 1200, 1200]);
      expect(result.clamps).toStrictEqual(["max_deficit", "floor"]);
    });

    it("should give seven copies of 3010 for the gain golden", () => {
      const result = deriveTargets({
        config: { goal: "gain", ratePctPerWeek: 0.25, proteinGPerKg: 2.0, fatFraction: 0.4 },
        tdee: 2800,
        trendWeight: 75,
        bmr: 1700,
      });

      expect(result.dowCaloriesKcal).toStrictEqual([3010, 3010, 3010, 3010, 3010, 3010, 3010]);
    });

    it("should give seven copies of 2410 for the maintain golden", () => {
      const result = deriveTargets({
        config: { goal: "maintain", ratePctPerWeek: 0, proteinGPerKg: 2.0, fatFraction: 0.4 },
        tdee: 2413.1,
        trendWeight: 80,
        bmr: 1700,
      });

      expect(result.dowCaloriesKcal).toStrictEqual([2410, 2410, 2410, 2410, 2410, 2410, 2410]);
    });

    it("should keep every day at 6000 and record no day clamp when the week is above 6000 and no day has an offset", () => {
      // The setup layer's 6000 cap owns the week's own calories, so a day with no offset is not a day clamp.
      const result = deriveTargets({
        config: { goal: "maintain", ratePctPerWeek: 0, proteinGPerKg: 1.6, fatFraction: 0.4 },
        tdee: 6630,
        trendWeight: 80,
        bmr: 1700,
      });

      expect(result.caloriesKcal).toBe(6630);
      expect(result.dowCaloriesKcal).toStrictEqual([6000, 6000, 6000, 6000, 6000, 6000, 6000]);
      expect(result.clamps).toStrictEqual([]);
    });
  });

  describe("with offsets", () => {
    it("should give 2350 on five days and 1650 on the weekend for [200 x5, -500, -500] on the lose golden", () => {
      const result = deriveTargets({
        config: { ...loseGolden, dowOffsetsKcal: [200, 200, 200, 200, 200, -500, -500] },
        tdee: 2579.54,
        trendWeight: 78.65,
        bmr: 1755,
      });

      expect(result.dowCaloriesKcal).toStrictEqual([2350, 2350, 2350, 2350, 2350, 1650, 1650]);
      expect(result.clamps).toStrictEqual([]);
    });

    it("should leave the week's calories, macros, rate and version as they are", () => {
      const result = deriveTargets({
        config: { ...loseGolden, dowOffsetsKcal: [200, 200, 200, 200, 200, -500, -500] },
        tdee: 2579.54,
        trendWeight: 78.65,
        bmr: 1755,
      });

      expect(result).toMatchObject({
        caloriesKcal: 2150,
        proteinG: 126,
        fatG: 73,
        carbsG: 247,
        engineVersion: "keylow-engine-v1",
      });
      expect(result.effectiveRatePctPerWeek).toBeCloseTo(0.4965, 4);
    });

    it("should round each day to the nearest 10, a tie going up", () => {
      const result = deriveTargets({
        config: { ...loseGolden, dowOffsetsKcal: [4, -4, 5, -5, 14, -14, 0] },
        tdee: 2579.54,
        trendWeight: 78.65,
        bmr: 1755,
      });

      // 2154 -> 2150, 2146 -> 2150, 2155 -> 2160, 2145 -> 2150, 2164 -> 2160, 2136 -> 2140
      expect(result.dowCaloriesKcal).toStrictEqual([2150, 2150, 2160, 2150, 2160, 2140, 2150]);
    });
  });

  describe("the floor, for lose only", () => {
    it("should raise Monday to 1200 and record dow_floor once for [-100, 100, 0, 0, 0, 0, 0] on the 1200 golden", () => {
      const result = deriveTargets({
        ...womanFloor,
        config: { ...womanFloor.config, dowOffsetsKcal: [-100, 100, 0, 0, 0, 0, 0] },
      });

      expect(result.caloriesKcal).toBe(1200);
      expect(result.dowCaloriesKcal).toStrictEqual([1200, 1300, 1200, 1200, 1200, 1200, 1200]);
      expect(result.clamps).toStrictEqual(["max_deficit", "floor", "dow_floor"]);
    });

    it("should record dow_floor once when several days are raised", () => {
      const result = deriveTargets({
        ...womanFloor,
        config: { ...womanFloor.config, dowOffsetsKcal: [-100, -50, -10, 40, 40, 40, 40] },
      });

      expect(result.dowCaloriesKcal).toStrictEqual([1200, 1200, 1200, 1240, 1240, 1240, 1240]);
      expect(result.clamps.filter((clamp) => clamp === "dow_floor")).toStrictEqual(["dow_floor"]);
    });

    it("should step a raised day up to the next multiple of 10 above a floor of 1355.4, not set it to 1355", () => {
      // BMR 1506 gives 0.9 x 1506 = 1355.4. The week is 1360 and Monday at -100 is 1260.
      const result = deriveTargets({
        config: {
          goal: "lose",
          ratePctPerWeek: 1.0,
          proteinGPerKg: 1.6,
          fatFraction: 0.4,
          dowOffsetsKcal: [-100, 100, 0, 0, 0, 0, 0],
        },
        tdee: 1700,
        trendWeight: 55,
        bmr: 1506,
      });

      expect(result.caloriesKcal).toBe(1360);
      expect(result.dowCaloriesKcal).toStrictEqual([1360, 1460, 1360, 1360, 1360, 1360, 1360]);
      expect(result.clamps).toContain("dow_floor");
    });

    it("should leave a day at 1360 alone when the floor is 1355.4 and the day is above it", () => {
      const result = deriveTargets({
        config: {
          goal: "lose",
          ratePctPerWeek: 1.0,
          proteinGPerKg: 1.6,
          fatFraction: 0.4,
          dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
        },
        tdee: 1700,
        trendWeight: 55,
        bmr: 1506,
      });

      expect(result.dowCaloriesKcal).toStrictEqual([1360, 1360, 1360, 1360, 1360, 1360, 1360]);
      expect(result.clamps).not.toContain("dow_floor");
    });

    it("should not apply the floor to maintain: a day of 1100 stays and no dow_floor is recorded", () => {
      const result = deriveTargets({
        config: {
          goal: "maintain",
          ratePctPerWeek: 0,
          proteinGPerKg: 1.6,
          fatFraction: 0.4,
          dowOffsetsKcal: [-400, 400, 0, 0, 0, 0, 0],
        },
        tdee: 1500,
        trendWeight: 60,
        bmr: 1300,
      });

      expect(result.dowCaloriesKcal).toStrictEqual([1100, 1900, 1500, 1500, 1500, 1500, 1500]);
      expect(result.clamps).toStrictEqual([]);
    });

    it("should not apply the floor to gain: a day of 810 stays and no dow_floor is recorded", () => {
      // tdee 1000 at 40 kg gaining 0.25% a week is 110 kcal a day more, so the week is 1110.
      const result = deriveTargets({
        config: {
          goal: "gain",
          ratePctPerWeek: 0.25,
          proteinGPerKg: 1.6,
          fatFraction: 0.4,
          dowOffsetsKcal: [-300, 300, 0, 0, 0, 0, 0],
        },
        tdee: 1000,
        trendWeight: 40,
        bmr: 1000,
      });

      expect(result.caloriesKcal).toBe(1110);
      expect(result.dowCaloriesKcal).toStrictEqual([810, 1410, 1110, 1110, 1110, 1110, 1110]);
      expect(result.clamps).toStrictEqual([]);
    });
  });

  describe("the 800 to 6000 range, for every goal", () => {
    const maintainAt = (tdee: number, dowOffsetsKcal: DayOfWeekKcal) =>
      deriveTargets({
        config: {
          goal: "maintain",
          ratePctPerWeek: 0,
          proteinGPerKg: 1.6,
          fatFraction: 0.4,
          dowOffsetsKcal,
        },
        tdee,
        trendWeight: 60,
        bmr: 1300,
      });

    it("should give Monday 800, the range bound and not the floor, for maintain at 1110 with [-400, 400, 0, 0, 0, 0, 0]", () => {
      const result = maintainAt(1110, [-400, 400, 0, 0, 0, 0, 0]);

      expect(result.caloriesKcal).toBe(1110);
      expect(result.dowCaloriesKcal).toStrictEqual([800, 1510, 1110, 1110, 1110, 1110, 1110]);
      expect(result.clamps).toStrictEqual(["dow_range"]);
      expect(result.clamps).not.toContain("dow_floor");
    });

    it("should step a day of 790 up to 800", () => {
      const result = maintainAt(1000, [-210, 210, 0, 0, 0, 0, 0]);

      expect(result.dowCaloriesKcal).toStrictEqual([800, 1210, 1000, 1000, 1000, 1000, 1000]);
      expect(result.clamps).toStrictEqual(["dow_range"]);
    });

    it("should leave a day of exactly 800 alone and record no dow_range", () => {
      const result = maintainAt(1000, [-200, 200, 0, 0, 0, 0, 0]);

      expect(result.dowCaloriesKcal).toStrictEqual([800, 1200, 1000, 1000, 1000, 1000, 1000]);
      expect(result.clamps).toStrictEqual([]);
    });

    it("should step a day of 6010 down to 6000 and record dow_range", () => {
      const result = maintainAt(5900, [110, -110, 0, 0, 0, 0, 0]);

      expect(result.dowCaloriesKcal).toStrictEqual([6000, 5790, 5900, 5900, 5900, 5900, 5900]);
      expect(result.clamps).toStrictEqual(["dow_range"]);
    });

    it("should leave a day of exactly 6000 alone and record no dow_range", () => {
      const result = maintainAt(5900, [100, -100, 0, 0, 0, 0, 0]);

      expect(result.dowCaloriesKcal).toStrictEqual([6000, 5800, 5900, 5900, 5900, 5900, 5900]);
      expect(result.clamps).toStrictEqual([]);
    });

    it("should record dow_range once when days are cut at both ends", () => {
      const result = maintainAt(3000, [-2500, 2500, 0, 0, 0, 0, 0]);

      expect(result.dowCaloriesKcal).toStrictEqual([800, 5500, 3000, 3000, 3000, 3000, 3000]);
      expect(result.clamps).toStrictEqual(["dow_range"]);
    });

    it("should keep a lose day within 6000 as well", () => {
      const result = deriveTargets({
        config: {
          goal: "lose",
          ratePctPerWeek: 0.1,
          proteinGPerKg: 1.6,
          fatFraction: 0.4,
          dowOffsetsKcal: [2000, -2000, 0, 0, 0, 0, 0],
        },
        tdee: 5000,
        trendWeight: 90,
        bmr: 1900,
      });

      expect(result.caloriesKcal).toBe(4900);
      expect(result.dowCaloriesKcal).toStrictEqual([6000, 2900, 4900, 4900, 4900, 4900, 4900]);
      expect(result.clamps).toStrictEqual(["dow_range"]);
    });

    it("should keep a gain day within 800 as well", () => {
      const result = deriveTargets({
        config: {
          goal: "gain",
          ratePctPerWeek: 0.25,
          proteinGPerKg: 1.6,
          fatFraction: 0.4,
          dowOffsetsKcal: [-500, 500, 0, 0, 0, 0, 0],
        },
        tdee: 1000,
        trendWeight: 40,
        bmr: 1000,
      });

      expect(result.dowCaloriesKcal).toStrictEqual([800, 1610, 1110, 1110, 1110, 1110, 1110]);
      expect(result.clamps).toStrictEqual(["dow_range"]);
    });

    it("should list dow_floor before dow_range, and both before macro_fit", () => {
      // The woman of 55 kg at 1200: Monday -100 is below the floor, Tuesday +4900 is above 6000.
      const result = deriveTargets({
        config: {
          goal: "lose",
          ratePctPerWeek: 1.0,
          proteinGPerKg: 2.2,
          fatFraction: 0.4,
          dowOffsetsKcal: [-100, 4900, -4800, 0, 0, 0, 0],
        },
        tdee: 1700,
        trendWeight: 120,
        bmr: 1250,
      });

      expect(result.dowCaloriesKcal).toStrictEqual([1200, 6000, 1200, 1200, 1200, 1200, 1200]);
      expect(result.clamps).toStrictEqual([
        "max_deficit",
        "floor",
        "dow_floor",
        "dow_range",
        "macro_fit",
      ]);
    });
  });

  describe("invalid offsets", () => {
    const withOffsets = (dowOffsetsKcal: DayOfWeekKcal) =>
      deriveTargets({
        config: { ...loseGolden, dowOffsetsKcal },
        tdee: 2579.54,
        trendWeight: 78.65,
        bmr: 1755,
      });

    it("should throw a RangeError naming the length rule for 6 offsets", () => {
      // @ts-expect-error a runtime check for an array that is not a 7-tuple
      expect(() => withOffsets([0, 0, 0, 0, 0, 0])).toThrow(
        new RangeError("The day of week offsets must hold 7 whole numbers, Monday first."),
      );
    });

    it("should throw a RangeError naming the length rule for 8 offsets", () => {
      // @ts-expect-error a runtime check for an array that is not a 7-tuple
      expect(() => withOffsets([0, 0, 0, 0, 0, 0, 0, 0])).toThrow(
        new RangeError("The day of week offsets must hold 7 whole numbers, Monday first."),
      );
    });

    it("should throw a RangeError naming the whole number rule for a null element", () => {
      // @ts-expect-error a runtime check for a null that a stored array can hold
      expect(() => withOffsets([null, 0, 0, 0, 0, 0, 0])).toThrow(
        new RangeError("The day of week offsets must hold 7 whole numbers, Monday first."),
      );
    });

    it("should throw a RangeError naming the whole number rule for a fractional element", () => {
      expect(() => withOffsets([0.5, -0.5, 0, 0, 0, 0, 0])).toThrow(
        new RangeError("The day of week offsets must hold 7 whole numbers, Monday first."),
      );
    });

    it("should throw a RangeError naming the sum rule for offsets that sum to 100", () => {
      expect(() => withOffsets([100, 0, 0, 0, 0, 0, 0])).toThrow(
        new RangeError("The day of week offsets must sum to 0."),
      );
    });

    it("should throw a RangeError naming the sum rule for offsets that sum to -1", () => {
      expect(() => withOffsets([0, 0, 0, 0, 0, 0, -1])).toThrow(
        new RangeError("The day of week offsets must sum to 0."),
      );
    });

    it("should not put the offsets or any calorie figure in the message", () => {
      expect(() => withOffsets([123, 0, 0, 0, 0, 0, 0])).not.toThrow(/123|2150|2579/);
    });
  });
});

describe("deriveTargets day of week properties", () => {
  const offsetsSummingToZero = fc
    .array(fc.integer({ min: -300, max: 300 }), { minLength: 6, maxLength: 6 })
    .map((six): DayOfWeekKcal => {
      const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = six;
      return [a, b, c, d, e, f, -(a + b + c + d + e + f)];
    });

  const maintainConfig = (dowOffsetsKcal: DayOfWeekKcal) =>
    ({
      goal: "maintain",
      ratePctPerWeek: 0,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
      dowOffsetsKcal,
    }) as const;

  it("should sum the week to 7 times the calories within 7 x 5 kcal when the offsets sum to 0 and no clamp bites", () => {
    // tdee 2700 to 4000 keeps every day, at most 1800 away, inside 800 to 6000.
    fc.assert(
      fc.property(
        offsetsSummingToZero,
        fc.double({ min: 2700, max: 4000, noNaN: true }),
        (offsets, tdee) => {
          const result = deriveTargets({
            config: maintainConfig(offsets),
            tdee,
            trendWeight: 80,
            bmr: 1700,
          });
          const weekKcal = result.dowCaloriesKcal.reduce((sum, dayKcal) => sum + dayKcal, 0);

          expect(result.clamps).toStrictEqual([]);
          expect(Math.abs(weekKcal - 7 * result.caloriesKcal)).toBeLessThanOrEqual(7 * 5);
        },
      ),
    );
  });

  it("should keep every day a multiple of 10 within 800 to 6000 for any goal and offsets summing to 0", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<CalorieGoal>(...CALORIE_GOALS),
        fc.array(fc.integer({ min: -2500, max: 2500 }), { minLength: 6, maxLength: 6 }),
        fc.double({ min: 800, max: 6000, noNaN: true }),
        (goal, six, tdee) => {
          const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = six;
          const result = deriveTargets({
            config: {
              goal,
              ratePctPerWeek: 0.5,
              proteinGPerKg: 1.6,
              fatFraction: 0.4,
              dowOffsetsKcal: [a, b, c, d, e, f, -(a + b + c + d + e + f)],
            },
            tdee,
            trendWeight: 80,
            bmr: 1700,
          });

          for (const dayKcal of result.dowCaloriesKcal) {
            expect(dayKcal % 10).toBe(0);
            expect(dayKcal).toBeGreaterThanOrEqual(800);
            expect(dayKcal).toBeLessThanOrEqual(6000);
          }
        },
      ),
    );
  });

  it("should keep every lose day at or above the floor max(1200, 0.9 x BMR)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -2500, max: 2500 }), { minLength: 6, maxLength: 6 }),
        fc.double({ min: 1500, max: 4000, noNaN: true }),
        fc.double({ min: 1000, max: 2200, noNaN: true }),
        (six, tdee, bmr) => {
          const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = six;
          const result = deriveTargets({
            config: {
              goal: "lose",
              ratePctPerWeek: 0.5,
              proteinGPerKg: 1.6,
              fatFraction: 0.4,
              dowOffsetsKcal: [a, b, c, d, e, f, -(a + b + c + d + e + f)],
            },
            tdee,
            trendWeight: 80,
            bmr,
          });

          for (const dayKcal of result.dowCaloriesKcal) {
            expect(dayKcal).toBeGreaterThanOrEqual(Math.max(1200, 0.9 * bmr));
          }
        },
      ),
    );
  });
});

describe("deriveTargets days from the week held within 800 to 6000", () => {
  const maintainAt = (tdee: number, dowOffsetsKcal: DayOfWeekKcal) =>
    deriveTargets({
      config: {
        goal: "maintain",
        ratePctPerWeek: 0,
        proteinGPerKg: 1.6,
        fatFraction: 0.4,
        dowOffsetsKcal,
      },
      tdee,
      trendWeight: 60,
      bmr: 1300,
    });

  it("should give seven 6000s and no day clamp for a week of 6630 with zero offsets", () => {
    const result = maintainAt(6630, [0, 0, 0, 0, 0, 0, 0]);

    expect(result.caloriesKcal).toBe(6630);
    expect(result.dowCaloriesKcal).toStrictEqual([6000, 6000, 6000, 6000, 6000, 6000, 6000]);
    expect(result.clamps).toStrictEqual([]);
  });

  it("should give Monday 5700 and Tuesday 6000 with dow_range for a week of 6630 and [-300, 300, 0, 0, 0, 0, 0]", () => {
    const result = maintainAt(6630, [-300, 300, 0, 0, 0, 0, 0]);

    expect(result.dowCaloriesKcal).toStrictEqual([5700, 6000, 6000, 6000, 6000, 6000, 6000]);
    expect(result.clamps).toStrictEqual(["dow_range"]);
  });

  it("should give seven 800s and no day clamp for a week of 700 with zero offsets", () => {
    const result = maintainAt(700, [0, 0, 0, 0, 0, 0, 0]);

    expect(result.caloriesKcal).toBe(700);
    expect(result.dowCaloriesKcal).toStrictEqual([800, 800, 800, 800, 800, 800, 800]);
    expect(result.clamps).toStrictEqual([]);
  });

  it("should give Monday 800 and Tuesday 900 with dow_range for a week of 700 and [-100, 100, 0, 0, 0, 0, 0]", () => {
    const result = maintainAt(700, [-100, 100, 0, 0, 0, 0, 0]);

    expect(result.dowCaloriesKcal).toStrictEqual([800, 900, 800, 800, 800, 800, 800]);
    expect(result.clamps).toStrictEqual(["dow_range"]);
  });
});

describe("deriveTargets day of week with other params", () => {
  it("should use the params' rounding step and floor for the days", () => {
    // Floor 1500 and a step of 5. The week is 1500. Monday 1400 and Wednesday 1497 -> 1495 are below the
    // floor and go to 1500. Tuesday 1603 rounds to 1605, not 1600.
    const params = {
      ...DEFAULT_ENGINE_PARAMS,
      targets: { ...DEFAULT_ENGINE_PARAMS.targets, floorAbsKcal: 1500, roundToKcal: 5 },
    };
    const result = deriveTargets(
      {
        config: {
          goal: "lose",
          ratePctPerWeek: 1.0,
          proteinGPerKg: 1.6,
          fatFraction: 0.4,
          dowOffsetsKcal: [-100, 103, -3, 0, 0, 0, 0],
        },
        tdee: 1700,
        trendWeight: 55,
        bmr: 1250,
      },
      params,
    );

    expect(result.caloriesKcal).toBe(1500);
    expect(result.dowCaloriesKcal).toStrictEqual([1500, 1605, 1500, 1500, 1500, 1500, 1500]);
    expect(result.clamps).toStrictEqual(["max_deficit", "floor", "dow_floor"]);
  });

  it("should step a day up to 1360 above a floor of 1351.8, not round it to 1350", () => {
    // BMR 1502 gives 0.9 x 1502 = 1351.8. Monday at -100 is 1260.
    const result = deriveTargets({
      config: {
        goal: "lose",
        ratePctPerWeek: 1.0,
        proteinGPerKg: 1.6,
        fatFraction: 0.4,
        dowOffsetsKcal: [-100, 100, 0, 0, 0, 0, 0],
      },
      tdee: 1700,
      trendWeight: 55,
      bmr: 1502,
    });

    expect(result.caloriesKcal).toBe(1360);
    expect(result.dowCaloriesKcal).toStrictEqual([1360, 1460, 1360, 1360, 1360, 1360, 1360]);
    expect(result.clamps).toContain("dow_floor");
  });
});

describe("toDayOfWeekKcal", () => {
  it("should return the seven whole numbers, Monday first", () => {
    expect(toDayOfWeekKcal([2010, 2020, 2030, 2040, 2050, 2060, 2070])).toStrictEqual([
      2010, 2020, 2030, 2040, 2050, 2060, 2070,
    ]);
  });

  it("should throw a RangeError naming the rule for 6 figures", () => {
    expect(() => toDayOfWeekKcal([1, 2, 3, 4, 5, 6])).toThrow(
      new RangeError("The day of week figures must hold 7 whole numbers, Monday first."),
    );
  });

  it("should throw a RangeError naming the rule for 8 figures", () => {
    expect(() => toDayOfWeekKcal([1, 2, 3, 4, 5, 6, 7, 8])).toThrow(
      new RangeError("The day of week figures must hold 7 whole numbers, Monday first."),
    );
  });

  it("should throw a RangeError naming the rule for a null element", () => {
    // A database array can hold a null that the number[] type does not admit.
    // @ts-expect-error a runtime check for a null in a stored array
    expect(() => toDayOfWeekKcal([1, null, 3, 4, 5, 6, 7])).toThrow(
      new RangeError("The day of week figures must hold 7 whole numbers, Monday first."),
    );
  });

  it("should throw a RangeError naming the rule for a fractional element", () => {
    expect(() => toDayOfWeekKcal([1, 2, 3, 4.5, 5, 6, 7])).toThrow(
      new RangeError("The day of week figures must hold 7 whole numbers, Monday first."),
    );
  });
});
