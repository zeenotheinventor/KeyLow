import { beforeEach, describe, expect, it, vi } from "vitest";

import { estimateDensity } from "../../src/nutrition/density";
import {
  ML_PER_TBSP,
  ML_PER_TSP,
  SPOON_PORTIONS,
  canMeasureByVolume,
  densityForLogging,
  isSpoonPortionId,
} from "../../src/nutrition/volume";
import { buildFood } from "../../src/testing";

// The estimate is stubbed, so these tests do not depend on the numbers in the density table.
vi.mock("../../src/nutrition/density", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/nutrition/density")>();
  return { ...actual, estimateDensity: vi.fn(actual.estimateDensity) };
});

const noEstimate = () => vi.mocked(estimateDensity).mockReturnValue(null);
const estimateOf = (gPerMl: number) =>
  vi.mocked(estimateDensity).mockReturnValue({ gPerMl, basis: "group" });

beforeEach(() => {
  vi.mocked(estimateDensity).mockReset();
  noEstimate();
});

describe("spoon constants", () => {
  it("should be 5 ml to a teaspoon and 15 ml to a tablespoon", () => {
    expect(ML_PER_TSP).toBe(5);
    expect(ML_PER_TBSP).toBe(15);
  });

  it("should make the spoon portions out of those constants, in millilitres", () => {
    expect(SPOON_PORTIONS).toEqual([
      { id: "spoon-tsp", label: "1 tsp", grams: null, ml: ML_PER_TSP },
      { id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: ML_PER_TBSP },
    ]);
  });
});

describe("isSpoonPortionId", () => {
  it.each(SPOON_PORTIONS.map((portion) => portion.id))("should recognise %s", (id) => {
    expect(isSpoonPortionId(id)).toBe(true);
  });

  it.each(["00000000-0000-4000-8000-0000000000c1", "snapshot-portion", "spoon", ""])(
    "should not recognise %j",
    (id) => {
      expect(isSpoonPortionId(id)).toBe(false);
    },
  );
});

describe("canMeasureByVolume", () => {
  it("should be true for a per 100 ml food, which needs no density", () => {
    expect(canMeasureByVolume(buildFood({ basis: "per_100ml" }))).toBe(true);
    expect(estimateDensity).not.toHaveBeenCalled();
  });

  it("should be true for a per 100 g food that has an estimated density", () => {
    estimateOf(0.92);

    expect(canMeasureByVolume(buildFood({ basis: "per_100g" }))).toBe(true);
  });

  it("should be false for a per 100 g food with no estimate", () => {
    expect(canMeasureByVolume(buildFood({ basis: "per_100g" }))).toBe(false);
  });
});

describe("densityForLogging", () => {
  it("should be the food's own density first, without asking for an estimate", () => {
    estimateOf(0.5);

    expect(densityForLogging(buildFood({ density_g_per_ml: 1.03 }))).toBe(1.03);
    expect(estimateDensity).not.toHaveBeenCalled();
  });

  it("should be the estimate when the food has no density of its own", () => {
    estimateOf(0.92);

    expect(densityForLogging(buildFood({ density_g_per_ml: null }))).toBe(0.92);
  });

  it("should be null when there is neither", () => {
    expect(densityForLogging(buildFood({ density_g_per_ml: null }))).toBeNull();
  });
});
