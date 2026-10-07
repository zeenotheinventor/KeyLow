import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { scaleNutrients, sumNutrients } from "../../src/nutrition/scale";
import { resolveQuantity } from "../../src/nutrition/units";

import type { NullableNutrients } from "../../src/schemas/nutrients";

const bread: NullableNutrients = {
  kcal: 250,
  protein_g: 12.5,
  fat_g: 8,
  carbs_g: 30,
  fibre_g: 3.2,
};

const unknownNutrients: NullableNutrients = {
  kcal: null,
  protein_g: null,
  fat_g: null,
  carbs_g: null,
  fibre_g: null,
};

const optionalKeys = ["sat_fat_g", "sugars_g", "salt_g"] as const;
const allKeys = ["kcal", "protein_g", "fat_g", "carbs_g", "fibre_g", ...optionalKeys] as const;

describe("scaleNutrients", () => {
  it("should multiply every nutrient by amount / 100", () => {
    expect(scaleNutrients(bread, 50)).toEqual({
      kcal: 125,
      protein_g: 6.25,
      fat_g: 4,
      carbs_g: 15,
      fibre_g: 1.6,
    });
  });

  it("should return the per 100 values unchanged for an amount of 100", () => {
    expect(scaleNutrients(bread, 100)).toEqual(bread);
  });

  it("should return zeros for an amount of zero", () => {
    expect(scaleNutrients(bread, 0)).toEqual({
      kcal: 0,
      protein_g: 0,
      fat_g: 0,
      carbs_g: 0,
      fibre_g: 0,
    });
  });

  it("should scale the optional nutrients when they are present", () => {
    const full = { ...bread, sat_fat_g: 2, sugars_g: 5, salt_g: 1 };
    expect(scaleNutrients(full, 200)).toEqual({
      kcal: 500,
      protein_g: 25,
      fat_g: 16,
      carbs_g: 60,
      fibre_g: 6.4,
      sat_fat_g: 4,
      sugars_g: 10,
      salt_g: 2,
    });
  });

  it("should leave a null nutrient null, because unknown is not zero", () => {
    expect(scaleNutrients({ ...bread, fibre_g: null, salt_g: null }, 50)).toEqual({
      kcal: 125,
      protein_g: 6.25,
      fat_g: 4,
      carbs_g: 15,
      fibre_g: null,
      salt_g: null,
    });
  });

  it("should leave an absent optional nutrient absent", () => {
    const scaled = scaleNutrients(bread, 50);
    expect(Object.keys(scaled)).not.toContain("sat_fat_g");
    expect(Object.keys(scaled)).not.toContain("sugars_g");
    expect(Object.keys(scaled)).not.toContain("salt_g");
  });

  it("should not round, so the full float is kept", () => {
    expect(scaleNutrients({ ...bread, kcal: 1 }, 33.333333).kcal).toBe(1 * (33.333333 / 100));
  });

  it("should not mutate its input", () => {
    const input = { ...bread };
    scaleNutrients(input, 50);
    expect(input).toEqual(bread);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "should throw a RangeError for the amount %s",
    (amount) => {
      expect(() => scaleNutrients(bread, amount)).toThrow(RangeError);
    },
  );
});

describe("sumNutrients", () => {
  it("should add each nutrient across the items", () => {
    expect(
      sumNutrients([
        { kcal: 100, protein_g: 10, fat_g: 1, carbs_g: 5, fibre_g: 0.5 },
        { kcal: 50, protein_g: 2.5, fat_g: 4, carbs_g: 10, fibre_g: 1 },
      ]),
    ).toEqual({ kcal: 150, protein_g: 12.5, fat_g: 5, carbs_g: 15, fibre_g: 1.5 });
  });

  it("should return the item itself in value for a single item", () => {
    expect(sumNutrients([bread])).toEqual(bread);
  });

  it("should return zeros for the five required nutrients and no optional keys for an empty list", () => {
    const total = sumNutrients([]);
    expect(total).toEqual({ kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fibre_g: 0 });
    expect(Object.keys(total)).toEqual(["kcal", "protein_g", "fat_g", "carbs_g", "fibre_g"]);
  });

  it("should be null for a nutrient that any item has as null, never silently 0", () => {
    expect(sumNutrients([bread, { ...bread, fibre_g: null }, bread]).fibre_g).toBeNull();
  });

  it("should keep the other nutrients known when one is null", () => {
    expect(sumNutrients([bread, { ...bread, fibre_g: null }])).toEqual({
      kcal: 500,
      protein_g: 25,
      fat_g: 16,
      carbs_g: 60,
      fibre_g: null,
    });
  });

  it("should be all null when every item is unknown", () => {
    expect(sumNutrients([unknownNutrients, unknownNutrients])).toEqual(unknownNutrients);
  });

  it("should add an optional nutrient when every item has it", () => {
    const total = sumNutrients([
      { ...bread, sat_fat_g: 2 },
      { ...bread, sat_fat_g: 1.5 },
    ]);
    expect(total.sat_fat_g).toBe(3.5);
  });

  it("should be null for an optional nutrient that any item has as null", () => {
    const total = sumNutrients([
      { ...bread, sugars_g: 4 },
      { ...bread, sugars_g: null },
    ]);
    expect(total.sugars_g).toBeNull();
  });

  it("should be null for an optional nutrient that some items leave absent, because absent is unknown", () => {
    const total = sumNutrients([{ ...bread, salt_g: 1 }, bread]);
    expect(total.salt_g).toBeNull();
  });

  it("should leave an optional nutrient absent when every item leaves it absent", () => {
    const total = sumNutrients([bread, bread]);
    expect(Object.keys(total)).not.toContain("salt_g");
  });

  it("should not mutate its input", () => {
    const items = [{ ...bread }, { ...bread }];
    sumNutrients(items);
    expect(items).toEqual([bread, bread]);
  });
});

describe("the document goldens, resolved then scaled", () => {
  it("should give 175 kcal for 2 slices of 35 g at 250 kcal per 100 g", () => {
    const resolved = resolveQuantity({ basis: "per_100g", density_g_per_ml: null }, 2, "portion", {
      grams: 35,
      ml: null,
    });
    expect(scaleNutrients(bread, resolved.amount).kcal).toBeCloseTo(175, 9);
  });

  const milkPer100 = { ...bread, kcal: 64 };
  const milk = { basis: "per_100ml", density_g_per_ml: 1.03 } as const;

  it("should give 160 kcal for 250 ml of milk at 64 kcal per 100 ml", () => {
    const resolved = resolveQuantity(milk, 250, "ml");
    expect(scaleNutrients(milkPer100, resolved.amount).kcal).toBeCloseTo(160, 9);
  });

  it("should give 155.34 kcal for 250 g of milk at a density of 1.03", () => {
    const resolved = resolveQuantity(milk, 250, "g");
    const kcal = scaleNutrients(milkPer100, resolved.amount).kcal;
    expect(kcal).toBeCloseTo(155.34, 2);
    expect(kcal).toBeCloseTo(155.339805825, 8);
  });

  it("should give 120.666 kcal for 1 tbsp (15 ml) of olive oil at 884 kcal per 100 g and a density of 0.91", () => {
    // The document quotes 120.66, which is this exact value truncated rather than rounded.
    const resolved = resolveQuantity({ basis: "per_100g", density_g_per_ml: 0.91 }, 1, "portion", {
      grams: null,
      ml: 15,
    });
    expect(scaleNutrients({ ...bread, kcal: 884 }, resolved.amount).kcal).toBeCloseTo(120.666, 9);
  });
});

const nutrientAmount = fc.double({ min: 0, max: 1e6, noNaN: true });
const optionalNutrientAmount = fc.option(nutrientAmount, { nil: null });

const nullableNutrientsArbitrary = fc.record(
  {
    kcal: optionalNutrientAmount,
    protein_g: optionalNutrientAmount,
    fat_g: optionalNutrientAmount,
    carbs_g: optionalNutrientAmount,
    fibre_g: optionalNutrientAmount,
    sat_fat_g: optionalNutrientAmount,
    sugars_g: optionalNutrientAmount,
    salt_g: optionalNutrientAmount,
  },
  { requiredKeys: ["kcal", "protein_g", "fat_g", "carbs_g", "fibre_g"] },
);

const knownNutrientsArbitrary = fc.record({
  kcal: nutrientAmount,
  protein_g: nutrientAmount,
  fat_g: nutrientAmount,
  carbs_g: nutrientAmount,
  fibre_g: nutrientAmount,
  sat_fat_g: nutrientAmount,
  sugars_g: nutrientAmount,
  salt_g: nutrientAmount,
});

const relativeTolerance = (actual: number, expected: number) =>
  1e-9 * Math.max(1, Math.abs(actual), Math.abs(expected));

const expectNutrientsCloseRelative = (actual: NullableNutrients, expected: NullableNutrients) => {
  for (const key of allKeys) {
    const actualValue = actual[key];
    const expectedValue = expected[key];
    if (typeof actualValue === "number" && typeof expectedValue === "number") {
      expect(Math.abs(actualValue - expectedValue)).toBeLessThanOrEqual(
        relativeTolerance(actualValue, expectedValue),
      );
    } else {
      expect(actualValue).toBe(expectedValue);
    }
  }
};

describe("scaleNutrients properties", () => {
  it("should be linear in the amount within 1e-9 relative", () => {
    fc.assert(
      fc.property(
        knownNutrientsArbitrary,
        nutrientAmount,
        nutrientAmount,
        (per100, first, second) => {
          const separately = sumNutrients([
            scaleNutrients(per100, first),
            scaleNutrients(per100, second),
          ]);
          expectNutrientsCloseRelative(separately, scaleNutrients(per100, first + second));
        },
      ),
    );
  });

  it("should keep every null null and every absent key absent", () => {
    fc.assert(
      fc.property(nullableNutrientsArbitrary, nutrientAmount, (per100, amount) => {
        const scaled = scaleNutrients(per100, amount);
        for (const key of allKeys) {
          if (per100[key] === null) {
            expect(scaled[key]).toBeNull();
          }
          if (!(key in per100)) {
            expect(key in scaled).toBe(false);
          }
        }
      }),
    );
  });
});

describe("sumNutrients properties", () => {
  it("should not depend on the order of the items", () => {
    fc.assert(
      fc.property(fc.array(knownNutrientsArbitrary, { maxLength: 8 }), (items) => {
        expectNutrientsCloseRelative(sumNutrients(items), sumNutrients([...items].reverse()));
      }),
    );
  });

  it("should not depend on the order of the items when some values are null or absent", () => {
    fc.assert(
      fc.property(fc.array(nullableNutrientsArbitrary, { maxLength: 8 }), (items) => {
        expectNutrientsCloseRelative(sumNutrients(items), sumNutrients([...items].reverse()));
      }),
    );
  });

  it("should be associative within 1e-9 relative", () => {
    fc.assert(
      fc.property(
        knownNutrientsArbitrary,
        knownNutrientsArbitrary,
        knownNutrientsArbitrary,
        (first, second, third) => {
          expectNutrientsCloseRelative(
            sumNutrients([sumNutrients([first, second]), third]),
            sumNutrients([first, sumNutrients([second, third])]),
          );
        },
      ),
    );
  });

  it("should be null for a nutrient exactly when any item has it null", () => {
    fc.assert(
      fc.property(fc.array(nullableNutrientsArbitrary, { minLength: 1, maxLength: 8 }), (items) => {
        const total = sumNutrients(items);
        for (const key of allKeys) {
          const anyUnknown = items.some((item) => item[key] === null || item[key] === undefined);
          const everyAbsent = items.every((item) => item[key] === undefined);
          if (everyAbsent) {
            expect(key in total).toBe(false);
          } else {
            expect(total[key] === null).toBe(anyUnknown);
          }
        }
      }),
    );
  });
});
