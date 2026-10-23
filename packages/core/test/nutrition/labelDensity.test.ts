import { describe, expect, it } from "vitest";

import { normaliseOffProduct } from "../../src/foods/off";
import {
  LABEL_DENSITY_RANGE,
  densityFromPortions,
  parseServingLabel,
} from "../../src/nutrition/labelDensity";

describe("parseServingLabel", () => {
  it.each([
    ["1 tbsp (15 g)", { volumeMl: 15, grams: 15 }],
    ["15ml (15g)", { volumeMl: 15, grams: 15 }],
    ["1 Tbsp. (14g)", { volumeMl: 15, grams: 14 }],
    ["2 tsp / 4 g", { volumeMl: 10, grams: 4 }],
    ["100 ml (103 g)", { volumeMl: 100, grams: 103 }],
    ["1 TEASPOON (2.5 grams)", { volumeMl: 5, grams: 2.5 }],
    ["2 tablespoons (30g)", { volumeMl: 30, grams: 30 }],
    ["1/4 cup (60 g)", { volumeMl: 62.5, grams: 60 }],
    ["1 1/2 tbsp (21 g)", { volumeMl: 22.5, grams: 21 }],
    ["0.5 tsp (1 g)", { volumeMl: 2.5, grams: 1 }],
    ["1 fl oz (30 g)", { volumeMl: 29.5735, grams: 30 }],
    ["1 fl. oz. (30 g)", { volumeMl: 29.5735, grams: 30 }],
    ["2 cl (20 g)", { volumeMl: 20, grams: 20 }],
    ["0.25 l (260 g)", { volumeMl: 250, grams: 260 }],
    ["15 ml 15 g", { volumeMl: 15, grams: 15 }],
    ["½ cup (120 g)", { volumeMl: 125, grams: 120 }],
    ["¼ tsp (1 g)", { volumeMl: 1.25, grams: 1 }],
    ["¾ tbsp (9 g)", { volumeMl: 11.25, grams: 9 }],
    ["1½ tbsp (21 g)", { volumeMl: 22.5, grams: 21 }],
    ["1 ½ tbsp (21 g)", { volumeMl: 22.5, grams: 21 }],
  ])("should read %s", (label, expected) => {
    expect(parseServingLabel(label)).toEqual(expected);
  });

  it("should prefer the stated millilitres to a household unit that sits beside them", () => {
    expect(parseServingLabel("1 cup (240 ml) 250 g")).toEqual({ volumeMl: 240, grams: 250 });
  });

  it("should read a volume with no grams as a volume alone", () => {
    expect(parseServingLabel("1 tbsp")).toEqual({ volumeMl: 15, grams: null });
    expect(parseServingLabel("1 tbsp (15 ml)")).toEqual({ volumeMl: 15, grams: null });
  });

  it.each([
    ["1 serving"],
    ["30 g"],
    ["1 bar (40 g)"],
    ["1 slice"],
    [""],
    ["   "],
    ["1-2 tbsp (15 g)"],
    ["1 to 2 tbsp (15 g)"],
    ["1 tbsp (15 g) or 2 tbsp (30 g)"],
    ["1 tbsp (100 ml) 15 g"],
    ["1 tbsp (15 g or 20 g)"],
    ["1 tbsp (0.5 oz)"],
    ["2 pieces 1 tbsp (15 g)"],
    ["1 heaped tbsp (15 g)"],
    ["1 rounded tsp (5 g)"],
    ["0 tsp (5 g)"],
    ["tbsp (15 g)"],
    ["1 tablespoonful (15 g)"],
    ["15 gml"],
    ["½ of 2 tbsp (30 g)"],
  ])("should reject %j", (label) => {
    expect(parseServingLabel(label)).toBeNull();
  });
});

describe("densityFromPortions", () => {
  it("should divide the label's grams by the label's volume", () => {
    expect(densityFromPortions([{ label: "1 tbsp (15 g)", grams: 15, ml: null }])).toBeCloseTo(1);
    expect(densityFromPortions([{ label: "2 tsp (4 g)", grams: 4, ml: null }])).toBeCloseTo(0.4);
    expect(densityFromPortions([{ label: "100 ml (103 g)", grams: null, ml: 100 }])).toBeCloseTo(
      1.03,
    );
  });

  it("should take the grams from the portion row when the label names only a volume", () => {
    expect(densityFromPortions([{ label: "1 tbsp", grams: 12, ml: null }])).toBeCloseTo(0.8);
  });

  it("should not mix a label's volume with millilitres of the row, since they carry no grams", () => {
    expect(densityFromPortions([{ label: "1 tbsp (15 ml)", grams: null, ml: 15 }])).toBeNull();
  });

  it("should accept a label and a row that agree on the grams", () => {
    expect(densityFromPortions([{ label: "1 tbsp (15 g)", grams: 15, ml: null }])).toBe(1);
    expect(densityFromPortions([{ label: "1 tbsp (15 g)", grams: 15.1, ml: null }])).toBe(1);
  });

  it("should reject a label and a row that disagree on the grams", () => {
    expect(densityFromPortions([{ label: "1 tbsp (15 g)", grams: 30, ml: null }])).toBeNull();
  });

  it("should return null for a portion with no volume in its label", () => {
    expect(densityFromPortions([{ label: "1 serving", grams: 30, ml: null }])).toBeNull();
    expect(densityFromPortions([])).toBeNull();
  });

  it("should ignore a spoon portion, which has no grams", () => {
    expect(densityFromPortions([{ label: "1 tbsp", grams: null, ml: 15 }])).toBeNull();
  });

  it("should use the portion with the largest volume, whatever order they come in", () => {
    const teaspoon = { label: "1 tsp (3 g)", grams: 3, ml: null };
    const cup = { label: "1 cup (200 g)", grams: 200, ml: null };

    expect(densityFromPortions([teaspoon, cup])).toBe(0.8);
    expect(densityFromPortions([cup, teaspoon])).toBe(0.8);
  });

  it("should skip a portion that gives no density and use the next", () => {
    expect(
      densityFromPortions([
        { label: "1 serving", grams: 30, ml: null },
        { label: "1 tsp (4 g)", grams: 4, ml: null },
      ]),
    ).toBeCloseTo(0.8);
  });

  describe("plausibility guard", () => {
    it("should keep the ends of the range", () => {
      expect(LABEL_DENSITY_RANGE).toEqual({ min: 0.05, max: 2.5 });
      expect(densityFromPortions([{ label: "100 ml (5 g)", grams: null, ml: 100 }])).toBe(0.05);
      expect(densityFromPortions([{ label: "100 ml (250 g)", grams: null, ml: 100 }])).toBe(2.5);
    });

    it("should ignore a density below the range", () => {
      expect(densityFromPortions([{ label: "1 tbsp (0.5 g)", grams: 0.5, ml: null }])).toBeNull();
    });

    it("should ignore a density above the range", () => {
      expect(densityFromPortions([{ label: "1 tsp (30 g)", grams: 30, ml: null }])).toBeNull();
    });
  });
});

describe("densityFromPortions on the portion rows Open Food Facts really gives", () => {
  // For a per 100 g product, `servingPortion` stores serving_quantity as grams, even when the number in
  // the label is millilitres. The row then holds the millilitres as if they were grams.
  const rowsOf = (servingSize: string, servingQuantity: number, quantity = "250 g") => {
    const result = normaliseOffProduct({
      code: "5000000010011",
      product_name: "Sauce",
      quantity,
      serving_size: servingSize,
      serving_quantity: servingQuantity,
      nutriments: {
        "energy-kcal_100g": 100,
        proteins_100g: 1,
        fat_100g: 0,
        carbohydrates_100g: 25,
      },
    });
    if (!result.ok) {
      throw new Error("The product must normalise");
    }
    return result.portions;
  };

  it("should read a serving with its grams in the label", () => {
    expect(densityFromPortions(rowsOf("1 tbsp (15 g)", 15))).toBe(1);
  });

  it("should read nothing from a serving in spoons and millilitres, whose row holds the millilitres as grams", () => {
    const rows = rowsOf("1 tbsp (15 ml)", 15);

    expect(rows[0]).toMatchObject({ grams: 15, ml: null });
    expect(densityFromPortions(rows)).toBeNull();
  });

  it("should read nothing from a serving in millilitres alone", () => {
    const rows = rowsOf("15 ml", 15);

    expect(rows[0]).toMatchObject({ grams: 15, ml: null });
    expect(densityFromPortions(rows)).toBeNull();
  });

  it("should still read a spoon with no figure in millilitres and the grams of the row", () => {
    expect(densityFromPortions([{ label: "1 tbsp", grams: 12, ml: null }])).toBeCloseTo(0.8);
  });
});
