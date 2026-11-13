import { describe, expect, it } from "vitest";

import { canReach } from "../../src/plans/reach";

import type { FoodGain } from "../../src/plans/reach";

const gain = (kcal: number, protein_g: number): FoodGain => ({
  kcal,
  protein_g,
  carbs_g: 0,
  fat_g: 0,
});
const NOTHING_LOCKED = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

describe("canReach", () => {
  it("should accept a target a food reaches exactly", () => {
    expect(canReach({ kcal: 500, protein_g: 50 }, NOTHING_LOCKED, [gain(500, 50)])).toBe(true);
  });

  it("should refuse a target above everything the foods can add, with its tolerance", () => {
    expect(canReach({ kcal: 600, protein_g: 50 }, NOTHING_LOCKED, [gain(500, 50)])).toBe(false);
  });

  it("should refuse a target the locked recipes already overshoot", () => {
    expect(canReach({ kcal: 500 }, { ...NOTHING_LOCKED, kcal: 700 }, [gain(100, 0)])).toBe(false);
  });

  it("should accept a target within tolerance of what is locked, with no foods", () => {
    expect(canReach({ kcal: 500 }, { ...NOTHING_LOCKED, kcal: 510 }, [])).toBe(true);
  });

  it("should refuse a carbs target no food can reach, judged on its own", () => {
    expect(
      canReach({ kcal: 100, carbs_g: 80 }, NOTHING_LOCKED, [{ ...gain(100, 0), carbs_g: 10 }]),
    ).toBe(false);
  });

  it("should refuse calories and protein that are each reachable but not together", () => {
    // One food adds 500 kcal and 50 g of protein at most, in that proportion. Each target is inside what the
    // food can add alone (100 kcal of 500, 50 g of 50), but 100 kcal comes with 10 g of protein, not 50 g.
    // Only the test along the food's own direction sees this.
    expect(canReach({ kcal: 100, protein_g: 50 }, NOTHING_LOCKED, [gain(500, 50)])).toBe(false);
  });

  it("should accept the same two targets when a second food makes them reachable together", () => {
    expect(
      canReach({ kcal: 100, protein_g: 50 }, NOTHING_LOCKED, [gain(500, 50), gain(0, 50)]),
    ).toBe(true);
  });
});
