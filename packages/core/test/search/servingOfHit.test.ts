import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { servingOfHit } from "../../src/search";
import { buildFoodPortion } from "../../src/testing";

const hit = {
  basis: "per_100g",
  kcal: 95,
  protein_g: 1.2,
  fat_g: 0.1,
  carbs_g: 20.3,
  default_portion_id: null,
  default_portion_label: null,
  default_portion_grams: null,
  default_portion_ml: null,
} as const;
const medium = buildFoodPortion({ id: "portion-medium", label: "1 medium", grams: 100 });
const hitWithMedium = {
  ...hit,
  default_portion_id: "portion-medium",
  default_portion_label: "1 medium",
  default_portion_grams: 100,
} as const;

describe("servingOfHit", () => {
  it("should be 1 of the default portion, as the food has it now", () => {
    expect(servingOfHit(hitWithMedium, { basis: "per_100g" }, [medium])).toEqual({
      quantity: 1,
      unit: "portion",
      portion: medium,
    });
  });

  it("should be 100 g of a per 100 g food that has no default portion", () => {
    expect(servingOfHit(hit, { basis: "per_100g" }, [medium])).toEqual({
      quantity: 100,
      unit: "g",
    });
  });

  it("should be 100 ml of a per 100 ml food that has no default portion", () => {
    expect(servingOfHit({ ...hit, basis: "per_100ml" }, { basis: "per_100ml" }, [])).toEqual({
      quantity: 100,
      unit: "ml",
    });
  });

  it("should be 100 of the food's basis when its default portion has been replaced since the search", () => {
    const replaced = buildFoodPortion({ id: "portion-new", label: "1 large", grams: 150 });

    expect(servingOfHit(hitWithMedium, { basis: "per_100g" }, [replaced])).toEqual({
      quantity: 100,
      unit: "g",
    });
    expect(
      servingOfHit(
        {
          ...hitWithMedium,
          basis: "per_100ml",
          default_portion_grams: null,
          default_portion_ml: 250,
        },
        { basis: "per_100ml" },
        [],
      ),
    ).toEqual({ quantity: 100, unit: "ml" });
  });

  it("should take the basis of the food as it is now, when the search row is out of date", () => {
    expect(servingOfHit(hit, { basis: "per_100ml" }, [])).toEqual({ quantity: 100, unit: "g" });
    expect(servingOfHit(hitWithMedium, { basis: "per_100ml" }, [])).toEqual({
      quantity: 100,
      unit: "ml",
    });
  });

  it("should never carry a portion on an amount in grams or millilitres", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("per_100g", "per_100ml"),
        fc.boolean(),
        fc.array(fc.constantFrom(medium), { maxLength: 2 }),
        (basis, hasDefault, portions) => {
          const amount = servingOfHit(hasDefault ? hitWithMedium : hit, { basis }, portions);

          expect("portion" in amount).toBe(amount.unit === "portion");
        },
      ),
    );
  });
});
