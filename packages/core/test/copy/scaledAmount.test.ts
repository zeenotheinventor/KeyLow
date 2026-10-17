import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { describeLoggedAmount, describeRecipeYield, describeScaledAmount } from "../../src/copy";
import { SPOON_PORTIONS } from "../../src/nutrition";
import { scaleFactor, scaleIngredientAmount, scaleYield } from "../../src/recipes";

import type { LoggedAmount } from "../../src/copy";
import type { ScalableIngredient } from "../../src/recipes";

const [, tablespoon] = SPOON_PORTIONS;
if (tablespoon === undefined) {
  throw new Error("The spoon portions must include a tablespoon");
}

const inGrams = (grams: number): ScalableIngredient => ({
  quantity: grams,
  unit: "g",
  resolved_grams: grams,
  snapshot: { portion: null },
});
const inMillilitres = (millilitres: number, grams: number): ScalableIngredient => ({
  quantity: millilitres,
  unit: "ml",
  resolved_grams: grams,
  snapshot: { portion: null },
});
const asPortions = (
  quantity: number,
  resolvedGrams: number,
  portion: NonNullable<ScalableIngredient["snapshot"]["portion"]>,
): ScalableIngredient => ({
  quantity,
  unit: "portion",
  resolved_grams: resolvedGrams,
  snapshot: { portion },
});

const largeEgg = { label: "1 large", grams: 50 };
const mediumOnion = { label: "1 medium", grams: 110 };

/** An ingredient of a recipe saved at `recipeServings`, as it reads when scaled to `chosenServings`. */
const scaledTo = (
  ingredient: ScalableIngredient,
  chosenServings: number,
  recipeServings: number,
): string =>
  describeScaledAmount(
    scaleIngredientAmount(ingredient, scaleFactor(chosenServings, recipeServings)),
  );

const goldenIngredients = [inGrams(500), inGrams(200), inGrams(20)];
const frittataIngredients = [
  asPortions(6, 300, largeEgg),
  inMillilitres(100, 103),
  asPortions(1, 15, tablespoon),
  asPortions(1, 110, mediumOnion),
  inGrams(100),
  inGrams(60),
];

describe("describeScaledAmount of the chicken and rice at 6 servings", () => {
  it("should write the chicken, the rice and the oil", () => {
    expect(goldenIngredients.map((ingredient) => scaledTo(ingredient, 6, 4))).toEqual([
      "750 g",
      "300 g",
      "30 g",
    ]);
  });

  it("should write the yield line with the cooked weight scaled", () => {
    expect(describeRecipeYield(6, scaleYield(1100, scaleFactor(6, 4)))).toBe(
      "Makes 6 · 1,650 g cooked",
    );
  });
});

describe("describeScaledAmount of the frittata", () => {
  it.each([
    {
      servings: 2,
      captions: [
        "3 × 1 large (150 g)",
        "50 ml",
        "0.5 tbsp (7.5 ml)",
        "0.5 × 1 medium (55 g)",
        "50 g",
        "30 g",
      ],
      yieldLine: "Makes 2 · 310 g cooked",
    },
    {
      servings: 1,
      captions: [
        "1.5 × 1 large (75 g)",
        "25 ml",
        "0.25 tbsp (3.8 ml)",
        "0.25 × 1 medium (28 g)",
        "25 g",
        "15 g",
      ],
      yieldLine: "Makes 1 · 155 g cooked",
    },
    {
      servings: 4,
      captions: [
        "6 × 1 large (300 g)",
        "100 ml",
        "1 tbsp (15 ml)",
        "1 medium (110 g)",
        "100 g",
        "60 g",
      ],
      yieldLine: "Makes 4 · 620 g cooked",
    },
  ])("should write every row and the yield line at $servings servings", (row) => {
    const captions = frittataIngredients.map((ingredient) => scaledTo(ingredient, row.servings, 4));

    expect(captions).toEqual(row.captions);
    expect(describeRecipeYield(row.servings, scaleYield(620, scaleFactor(row.servings, 4)))).toBe(
      row.yieldLine,
    );
  });
});

describe("describeScaledAmount counts", () => {
  it("should write 1.33 of a medium onion for 4 servings out of 3", () => {
    expect(scaledTo(asPortions(1, 110, mediumOnion), 4, 3)).toBe("1.33 × 1 medium (147 g)");
  });

  it("should write 0.75 of a medium onion for 3 servings out of 4", () => {
    expect(scaledTo(asPortions(1, 110, mediumOnion), 3, 4)).toBe("0.75 × 1 medium (83 g)");
  });

  it("should write a quarter of a spoon as 0.25, not 0.3", () => {
    expect(scaledTo(asPortions(1, 15, tablespoon), 1, 4)).toBe("0.25 tbsp (3.8 ml)");
  });

  it("should write a teaspoon count with its volume", () => {
    const [teaspoon] = SPOON_PORTIONS;
    expect(scaledTo(asPortions(3, 15, teaspoon ?? tablespoon), 2, 4)).toBe("1.5 tsp (7.5 ml)");
  });

  it("should write a portion whose label says its size without the size twice", () => {
    expect(scaledTo(asPortions(1, 30, { label: "30 g", grams: 30 }), 4, 4)).toBe("30 g");
  });

  it("should keep the size of several portions of a label that says one portion's size", () => {
    expect(scaledTo(asPortions(1, 30, { label: "30 g", grams: 30 }), 8, 4)).toBe("2 × 30 g (60 g)");
  });

  it("should write a count a hair under 1 as one portion", () => {
    expect(
      describeScaledAmount({
        unit: "portion",
        quantity: 0.9999999999999999,
        resolvedGrams: 110,
        portion: { label: "1 medium" },
      }),
    ).toBe("1 medium (110 g)");
  });

  it("should write a count of portions without a unit as the rounded count", () => {
    expect(
      describeScaledAmount({
        unit: "portion",
        quantity: 2.5,
        resolvedGrams: 250,
        portion: { label: "1 medium" },
      }),
    ).toBe("2.5 × 1 medium (250 g)");
  });
});

describe("describeScaledAmount measured amounts", () => {
  it.each([
    [{ unit: "oz", quantity: 1.5, resolvedGrams: 42.5, portion: null }, "1.5 oz"],
    [{ unit: "fl_oz", quantity: 6.5, resolvedGrams: 192, portion: null }, "6.5 fl oz"],
    [{ unit: "g", quantity: 7.5, resolvedGrams: 7.5, portion: null }, "7.5 g"],
    [{ unit: "g", quantity: 3.75, resolvedGrams: 3.75, portion: null }, "3.8 g"],
  ] as const)("should write %# as %s", (amount, expected) => {
    expect(describeScaledAmount(amount)).toBe(expected);
  });

  it("should write 50,000 g with a thousands separator", () => {
    expect(scaledTo(inGrams(50), 1000, 1)).toBe("50,000 g");
  });

  it("should write millilitres with a thousands separator", () => {
    expect(scaledTo(inMillilitres(100, 103), 1000, 4)).toBe("25,000 ml");
  });

  it("should group the grams in the brackets of a portion", () => {
    expect(scaledTo(asPortions(6, 300, largeEgg), 1000, 4)).toBe("1,500 × 1 large (75,000 g)");
  });

  it("should group the volume in the brackets of a spoon", () => {
    expect(scaledTo(asPortions(1, 15, tablespoon), 1000, 1)).toBe("1,000 tbsp (15,000 ml)");
  });

  it("should write 999 g without a separator and 1,000 g with one", () => {
    expect(
      describeScaledAmount({ unit: "g", quantity: 999, resolvedGrams: 999, portion: null }),
    ).toBe("999 g");
    expect(
      describeScaledAmount({ unit: "g", quantity: 1000, resolvedGrams: 1000, portion: null }),
    ).toBe("1,000 g");
  });
});

describe("describeScaledAmount at an exact half", () => {
  it("should round 13.5 g from 3 to 13 servings up to 59, as the pair form 13.5 × 13 ÷ 3 = 58.5 does", () => {
    // 13.5 * (13 / 3) is 58.49999999999999 in floating point, which a plain rounding would show as 58.
    expect(scaledTo(inGrams(13.5), 13, 3)).toBe("59 g");
  });

  it("should round the grams in brackets at an exact half up too", () => {
    expect(scaledTo(asPortions(1, 13.5, mediumOnion), 13, 3)).toBe("4.33 × 1 medium (59 g)");
  });

  it("should round a count at an exact half up, as 1.5 from 20 to 3 servings is 0.225", () => {
    // 1.5 * (3 / 20) is 0.22499999999999998 in floating point, which a plain rounding would show as 0.22.
    expect(scaledTo(asPortions(1.5, 165, mediumOnion), 3, 20)).toBe("0.23 × 1 medium (25 g)");
  });

  it("should not move a value that is not at a half", () => {
    expect(scaledTo(inGrams(13.4), 13, 3)).toBe("58 g");
  });
});

describe("describeScaledAmount properties", () => {
  const belowAThousand = fc.integer({ min: 1, max: 9994 }).map((tenth) => tenth / 10);
  const portionCounts = fc.oneof(
    fc.integer({ min: 1, max: 60 }),
    fc.integer({ min: 1, max: 99 }).map((tenth) => tenth / 10),
  );
  const portions = fc.constantFrom(
    { label: "1 medium" },
    { label: "1 large" },
    { label: "30 g" },
    { label: tablespoon.label, ml: tablespoon.ml },
  );

  const measuredAmounts = fc
    .tuple(fc.constantFrom("g", "ml", "oz", "fl_oz"), belowAThousand)
    .map(([unit, quantity]): LoggedAmount => ({
      unit,
      quantity,
      resolvedGrams: quantity,
      portion: null,
    }));
  const portionAmounts = fc
    .tuple(portionCounts, belowAThousand, portions)
    .map(([quantity, resolvedGrams, portion]): LoggedAmount => ({
      unit: "portion",
      quantity,
      resolvedGrams,
      portion,
    }));

  it("should read as describeLoggedAmount at factor 1 for amounts below 1,000 with at most 1 decimal", () => {
    fc.assert(
      fc.property(fc.oneof(measuredAmounts, portionAmounts), (amount) => {
        expect(describeScaledAmount(amount)).toBe(describeLoggedAmount(amount));
      }),
    );
  });

  it("should never write a separator below 1,000 or the wrong unit", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 999.4, noNaN: true }),
        fc.constantFrom("g", "ml", "oz", "fl_oz"),
        (quantity, unit) => {
          const text = describeScaledAmount({
            unit,
            quantity,
            resolvedGrams: quantity,
            portion: null,
          });

          expect(text).toMatch(/^\d+(\.\d)? (g|ml|oz|fl oz)$/);
        },
      ),
    );
  });

  it("should write a grouped whole number from 1,000 up", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: 5_000_000 }), (grams) => {
        const text = describeScaledAmount({
          unit: "g",
          quantity: grams,
          resolvedGrams: grams,
          portion: null,
        });

        expect(text).toMatch(/^\d{1,3}(,\d{3})+ g$/);
        expect(text.replaceAll(",", "")).toBe(`${grams} g`);
      }),
    );
  });
});
