import { describe, expect, it } from "vitest";

import { ACTIVITY_LEVELS, SEXES } from "../../src/engine";
import { DIET_STYLES, GOALS, HEIGHT_UNITS, PROTEIN_PRESETS } from "../../src/setup";

describe("the lists the setup answers draw from", () => {
  it("should take the sexes from the engine, as literals", () => {
    expect(SEXES).toStrictEqual(["female", "male", "other"]);
  });

  it("should take the activity levels from the engine, in the order of their factors", () => {
    expect(ACTIVITY_LEVELS).toStrictEqual(["sedentary", "light", "moderate", "very", "extra"]);
  });

  it("should list the goals", () => {
    expect(GOALS).toStrictEqual(["lose", "maintain", "gain"]);
  });

  it("should list the height units", () => {
    expect(HEIGHT_UNITS).toStrictEqual(["cm", "ft_in"]);
  });

  it("should list the protein presets", () => {
    expect(PROTEIN_PRESETS).toStrictEqual(["moderate", "high", "very_high"]);
  });

  it("should list the diet styles, the keys of the engine's fat fractions", () => {
    expect(DIET_STYLES).toStrictEqual(["balanced", "low_fat", "low_carb"]);
  });
});
