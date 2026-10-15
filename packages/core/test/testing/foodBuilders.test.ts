import { describe, expect, it } from "vitest";

import { foodPortionSchema, foodRowSchema, offCandidateSchema } from "../../src/schemas";
import { buildFood, buildFoodPortion, buildOffCandidate } from "../../src/testing";

describe("buildFood", () => {
  it("should build a row the food schema accepts", () => {
    expect(foodRowSchema.safeParse(buildFood()).success).toBe(true);
  });

  it("should apply overrides over the defaults", () => {
    const food = buildFood({ name: "Oat cakes", kcal: 430, brand: "Acme" });

    expect(food).toMatchObject({ name: "Oat cakes", kcal: 430, brand: "Acme" });
  });

  it("should return a separate object on every call", () => {
    const first = buildFood();
    const second = buildFood();

    first.micros["iron_mg"] = 2;
    first.quality["suspect"] = true;

    expect(second.micros).toEqual({});
    expect(second.quality).toEqual({});
  });
});

describe("buildFoodPortion", () => {
  it("should build a row the portion schema accepts", () => {
    expect(foodPortionSchema.safeParse(buildFoodPortion()).success).toBe(true);
  });

  it("should apply overrides over the defaults", () => {
    const portion = buildFoodPortion({ label: "1 bar", grams: 45, is_default: true });

    expect(portion).toMatchObject({ label: "1 bar", grams: 45, is_default: true });
  });

  it("should return a separate object on every call", () => {
    const first = buildFoodPortion();

    first.label = "Changed";

    expect(buildFoodPortion().label).toBe("Portion");
  });
});

describe("buildOffCandidate", () => {
  it("should build a candidate the OFF candidate schema accepts", () => {
    expect(offCandidateSchema.safeParse(buildOffCandidate()).success).toBe(true);
  });

  it("should apply overrides over the defaults", () => {
    const candidate = buildOffCandidate({ name: "Oat drink", basis: "per_100ml", fibre_g: 0.8 });

    expect(candidate).toMatchObject({ name: "Oat drink", basis: "per_100ml", fibre_g: 0.8 });
  });

  it("should return a separate object on every call", () => {
    const first = buildOffCandidate();

    first.quality["suspect"] = true;

    expect(buildOffCandidate().quality).toEqual({});
  });
});
