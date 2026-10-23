import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  CALORIE_GOALS,
  CLAMPS,
  DEFAULT_ENGINE_PARAMS,
  deriveCalorieTarget,
  initialExpenditure,
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
