import { describe, expect, it } from "vitest";

import { deriveCalorieTarget } from "../../src/engine";
import { bindingCalorieClamp } from "../../src/setup";

describe("bindingCalorieClamp", () => {
  it("should give the floor when the deficit cap and the floor both apply, because the floor set the number", () => {
    expect(bindingCalorieClamp(["max_deficit", "floor"])).toBe("floor");
  });

  it("should give the deficit cap when it is the only calorie clamp", () => {
    expect(bindingCalorieClamp(["max_deficit"])).toBe("max_deficit");
  });

  it("should give the surplus cap when it is the only calorie clamp", () => {
    expect(bindingCalorieClamp(["max_surplus"])).toBe("max_surplus");
  });

  it("should give the profile maximum over the surplus cap, because the 6000 cap comes last", () => {
    expect(bindingCalorieClamp(["max_surplus", "profile_max"])).toBe("profile_max");
  });

  it("should give the profile maximum over the floor", () => {
    expect(bindingCalorieClamp(["floor", "profile_max"])).toBe("profile_max");
  });

  it("should give nothing when only clamps that do not set the calories apply", () => {
    expect(bindingCalorieClamp(["macro_fit"])).toBeUndefined();
    expect(bindingCalorieClamp(["max_rate", "macro_fit"])).toBeUndefined();
  });

  it("should give nothing for no clamps", () => {
    expect(bindingCalorieClamp([])).toBeUndefined();
  });

  it("should ignore a code it does not know", () => {
    expect(bindingCalorieClamp(["dow_floor", "max_deficit"])).toBe("max_deficit");
  });

  it("should not depend on the order the clamps are listed in", () => {
    expect(bindingCalorieClamp(["floor", "max_deficit"])).toBe("floor");
    expect(bindingCalorieClamp(["profile_max", "max_surplus"])).toBe("profile_max");
  });

  describe("against the engine's own clamp lists", () => {
    // Female, 30, 160 cm, 55.0 kg, sedentary, lose 1.0%: the canvas's floor case, BMR 1,239 and TDEE 1,486.8.
    it("should name the clamp that deriveCalorieTarget's final number came from, for the floor case", () => {
      const target = deriveCalorieTarget({
        goal: "lose",
        ratePctPerWeek: 1.0,
        tdee: 1486.8,
        trendWeight: 55,
        bmr: 1239,
      });

      expect(target.caloriesKcal).toBe(1200);
      expect(target.clamps).toEqual(["max_deficit", "floor"]);
      expect(bindingCalorieClamp(target.clamps)).toBe("floor");
    });

    // Male, 40, 175 cm, 130.0 kg, moderately active, lose 1.0%: the canvas's max deficit case.
    it("should name the deficit cap for the max deficit case", () => {
      const target = deriveCalorieTarget({
        goal: "lose",
        ratePctPerWeek: 1.0,
        tdee: 3408.1,
        trendWeight: 130,
        bmr: 2198.75,
      });

      expect(target.caloriesKcal).toBe(2390);
      expect(target.clamps).toEqual(["max_deficit"]);
      expect(bindingCalorieClamp(target.clamps)).toBe("max_deficit");
    });

    it("should name the surplus cap when a gain is held to 20% of expenditure", () => {
      const target = deriveCalorieTarget({
        goal: "gain",
        ratePctPerWeek: 0.5,
        tdee: 2000,
        trendWeight: 200,
        bmr: 1500,
      });

      expect(target.caloriesKcal).toBe(2400);
      expect(target.clamps).toEqual(["max_surplus"]);
      expect(bindingCalorieClamp(target.clamps)).toBe("max_surplus");
    });
  });
});
