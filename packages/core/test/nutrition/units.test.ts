import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  GRAMS_PER_OUNCE,
  ML_PER_FLUID_OUNCE,
  quantityUnitSchema,
  resolveQuantity,
} from "../../src/nutrition/units";

import type { QuantityUnit } from "../../src/nutrition/units";
import type { NutrientBasis } from "../../src/schemas/food";

const gramBasisFood = { basis: "per_100g", density_g_per_ml: null } as const;
const millilitreBasisFood = { basis: "per_100ml", density_g_per_ml: null } as const;
const milk = { basis: "per_100ml", density_g_per_ml: 1.03 } as const;
const oliveOil = { basis: "per_100g", density_g_per_ml: 0.91 } as const;
const gramPortion = { grams: 35, ml: null } as const;
const millilitrePortion = { grams: null, ml: 15 } as const;

const finiteQuantity = fc.double({ min: 0, max: 1e6, noNaN: true });
const positiveDensity = fc.double({ min: 0.01, max: 20, noNaN: true });

describe("conversion constants", () => {
  it("should be 28.3495 grams per ounce", () => {
    expect(GRAMS_PER_OUNCE).toBe(28.3495);
  });

  it("should be 29.5735 millilitres per fluid ounce", () => {
    expect(ML_PER_FLUID_OUNCE).toBe(29.5735);
  });
});

describe("quantityUnitSchema", () => {
  it.each(["g", "ml", "oz", "fl_oz", "portion"])("should accept %s", (unit) => {
    expect(quantityUnitSchema.parse(unit)).toBe(unit);
  });

  it("should reject serving, because recipes are not resolved here", () => {
    expect(quantityUnitSchema.safeParse("serving").success).toBe(false);
  });
});

describe("resolveQuantity when the unit matches the basis dimension", () => {
  it("should pass grams through for a per 100 g food", () => {
    expect(resolveQuantity(gramBasisFood, 80, "g")).toEqual({
      amount: 80,
      basis: "per_100g",
      densityAssumed: false,
    });
  });

  it("should pass millilitres through for a per 100 ml food", () => {
    expect(resolveQuantity(millilitreBasisFood, 250, "ml")).toEqual({
      amount: 250,
      basis: "per_100ml",
      densityAssumed: false,
    });
  });

  it("should convert ounces to grams for a per 100 g food", () => {
    const { amount } = resolveQuantity(gramBasisFood, 2, "oz");
    expect(amount).toBeCloseTo(56.699, 6);
  });

  it("should convert fluid ounces to millilitres for a per 100 ml food", () => {
    const { amount } = resolveQuantity(millilitreBasisFood, 2, "fl_oz");
    expect(amount).toBeCloseTo(59.147, 6);
  });

  it("should multiply a gram portion by the quantity for a per 100 g food", () => {
    expect(resolveQuantity(gramBasisFood, 2, "portion", gramPortion)).toEqual({
      amount: 70,
      basis: "per_100g",
      densityAssumed: false,
    });
  });

  it("should multiply a millilitre portion by the quantity for a per 100 ml food", () => {
    expect(resolveQuantity(milk, 3, "portion", millilitrePortion)).toEqual({
      amount: 45,
      basis: "per_100ml",
      densityAssumed: false,
    });
  });

  it("should not need a density, so a food with a density gives the same answer", () => {
    expect(resolveQuantity(milk, 250, "ml").amount).toBe(250);
  });
});

describe("resolveQuantity when the unit disagrees with the basis dimension", () => {
  it("should divide grams by the density for a per 100 ml food", () => {
    const resolved = resolveQuantity(milk, 250, "g");
    expect(resolved.amount).toBeCloseTo(242.7184466, 6);
    expect(resolved.basis).toBe("per_100ml");
    expect(resolved.densityAssumed).toBe(false);
  });

  it("should multiply millilitres by the density for a per 100 g food", () => {
    const resolved = resolveQuantity(oliveOil, 15, "ml");
    expect(resolved.amount).toBeCloseTo(13.65, 12);
    expect(resolved.basis).toBe("per_100g");
    expect(resolved.densityAssumed).toBe(false);
  });

  it("should convert ounces to grams and then to millilitres for a per 100 ml food", () => {
    const { amount } = resolveQuantity(milk, 1, "oz");
    expect(amount).toBeCloseTo(28.3495 / 1.03, 9);
  });

  it("should convert fluid ounces to millilitres and then to grams for a per 100 g food", () => {
    const { amount } = resolveQuantity(oliveOil, 1, "fl_oz");
    expect(amount).toBeCloseTo(29.5735 * 0.91, 9);
  });

  it("should convert a millilitre portion to grams for a per 100 g food", () => {
    const { amount } = resolveQuantity(oliveOil, 1, "portion", millilitrePortion);
    expect(amount).toBeCloseTo(13.65, 12);
  });

  it("should convert a gram portion to millilitres for a per 100 ml food", () => {
    const { amount } = resolveQuantity(milk, 2, "portion", gramPortion);
    expect(amount).toBeCloseTo(70 / 1.03, 9);
  });

  it("should assume a density of 1 and flag it when the food has none", () => {
    expect(resolveQuantity(millilitreBasisFood, 250, "g")).toEqual({
      amount: 250,
      basis: "per_100ml",
      densityAssumed: true,
    });
  });

  it("should flag an assumed density for a per 100 g food logged in millilitres", () => {
    expect(resolveQuantity(gramBasisFood, 15, "ml")).toEqual({
      amount: 15,
      basis: "per_100g",
      densityAssumed: true,
    });
  });

  it("should flag an assumed density for a portion whose dimension disagrees with the basis", () => {
    expect(resolveQuantity(gramBasisFood, 2, "portion", millilitrePortion).densityAssumed).toBe(
      true,
    );
  });
});

describe("resolveQuantity input validation", () => {
  it("should accept a quantity of zero", () => {
    expect(resolveQuantity(gramBasisFood, 0, "g").amount).toBe(0);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "should throw a RangeError for the quantity %s",
    (quantity) => {
      expect(() => resolveQuantity(gramBasisFood, quantity, "g")).toThrow(RangeError);
    },
  );

  it.each([0, -1, Number.NaN])(
    "should throw a RangeError for the density %s when the unit disagrees with the basis",
    (density) => {
      expect(() => resolveQuantity({ ...milk, density_g_per_ml: density }, 250, "g")).toThrow(
        RangeError,
      );
      expect(() => resolveQuantity({ ...oliveOil, density_g_per_ml: density }, 15, "ml")).toThrow(
        RangeError,
      );
    },
  );

  it("should not read the density when the unit matches the basis", () => {
    expect(resolveQuantity({ ...milk, density_g_per_ml: 0 }, 250, "ml").amount).toBe(250);
  });

  it("should throw a RangeError for the portion unit without a portion", () => {
    expect(() => resolveQuantity(gramBasisFood, 1, "portion")).toThrow(RangeError);
  });

  it("should throw a RangeError for a portion with neither grams nor ml", () => {
    expect(() => resolveQuantity(gramBasisFood, 1, "portion", { grams: null, ml: null })).toThrow(
      RangeError,
    );
  });

  it("should throw a RangeError for a portion with both grams and ml", () => {
    expect(() => resolveQuantity(gramBasisFood, 1, "portion", { grams: 35, ml: 15 })).toThrow(
      RangeError,
    );
  });
});

const dimensionOfBasis: Record<NutrientBasis, "mass" | "volume"> = {
  per_100g: "mass",
  per_100ml: "volume",
};

const unitArbitrary = fc.constantFrom<QuantityUnit>("g", "ml", "oz", "fl_oz", "portion");
const basisArbitrary = fc.constantFrom<NutrientBasis>("per_100g", "per_100ml");
const portionArbitrary = fc.oneof(
  fc.double({ min: 0.1, max: 1000, noNaN: true }).map((grams) => ({ grams, ml: null })),
  fc.double({ min: 0.1, max: 1000, noNaN: true }).map((ml) => ({ grams: null, ml })),
);
const densityArbitrary = fc.oneof(fc.constant(null), positiveDensity);

describe("resolveQuantity properties", () => {
  it("should round trip ounces through grams within 1e-9 relative", () => {
    fc.assert(
      fc.property(finiteQuantity, (ounces) => {
        const { amount: grams } = resolveQuantity(gramBasisFood, ounces, "oz");
        expect(Math.abs(grams / 28.3495 - ounces)).toBeLessThanOrEqual(1e-9 * Math.max(1, ounces));
      }),
    );
  });

  it("should round trip fluid ounces through millilitres within 1e-9 relative", () => {
    fc.assert(
      fc.property(finiteQuantity, (fluidOunces) => {
        const { amount: millilitres } = resolveQuantity(millilitreBasisFood, fluidOunces, "fl_oz");
        expect(Math.abs(millilitres / 29.5735 - fluidOunces)).toBeLessThanOrEqual(
          1e-9 * Math.max(1, fluidOunces),
        );
      }),
    );
  });

  it("should flag an assumed density exactly when the dimensions differ and the density is null", () => {
    fc.assert(
      fc.property(
        basisArbitrary,
        densityArbitrary,
        unitArbitrary,
        portionArbitrary,
        finiteQuantity,
        (basis, density, unit, portion, quantity) => {
          const item = { basis, density_g_per_ml: density };
          const unitDimension =
            unit === "portion"
              ? portion.grams === null
                ? "volume"
                : "mass"
              : unit === "g" || unit === "oz"
                ? "mass"
                : "volume";
          const expected = unitDimension !== dimensionOfBasis[basis] && density === null;
          expect(resolveQuantity(item, quantity, unit, portion).densityAssumed).toBe(expected);
        },
      ),
    );
  });

  it("should relate mass and volume by the density within 1e-9 relative", () => {
    fc.assert(
      fc.property(basisArbitrary, positiveDensity, finiteQuantity, (basis, density, quantity) => {
        const item = { basis, density_g_per_ml: density };
        const inGrams = resolveQuantity(item, quantity, "g").amount;
        const inMillilitres = resolveQuantity(item, quantity, "ml").amount;
        const [crossDimension, sameDimension] =
          basis === "per_100ml"
            ? [inGrams * density, inMillilitres]
            : [inMillilitres / density, inGrams];
        expect(Math.abs(crossDimension - sameDimension)).toBeLessThanOrEqual(
          1e-9 * Math.max(1, sameDimension),
        );
      }),
    );
  });

  it("should never decrease the amount as the quantity grows", () => {
    fc.assert(
      fc.property(
        basisArbitrary,
        densityArbitrary,
        unitArbitrary,
        portionArbitrary,
        finiteQuantity,
        finiteQuantity,
        (basis, density, unit, portion, first, second) => {
          const item = { basis, density_g_per_ml: density };
          const smaller = Math.min(first, second);
          const larger = Math.max(first, second);
          expect(resolveQuantity(item, smaller, unit, portion).amount).toBeLessThanOrEqual(
            resolveQuantity(item, larger, unit, portion).amount,
          );
        },
      ),
    );
  });
});
