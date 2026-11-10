import { describe, expect, it } from "vitest";

import {
  ESTIMATE_CATEGORY_ROWS,
  ESTIMATE_ENERGY_BANDS_PER_100G,
  ESTIMATE_ENERGY_BANDS_PER_100ML,
  ESTIMATE_GENERIC_NOUN,
  estimatedPortion,
  estimatedPortionLabel,
  isEstimatedPortion,
} from "../../src/foods/estimatedPortion";

describe("isEstimatedPortion", () => {
  it.each(["1 typical serving", "1 typical burger"])("should recognise %s", (label) => {
    expect(isEstimatedPortion(label)).toBe(true);
  });

  it.each(["1 serving", "1 burger", "240 g", "2 typical servings", "1 typicalish"])(
    "should not recognise %s",
    (label) => {
      expect(isEstimatedPortion(label)).toBe(false);
    },
  );
});

describe("estimatedPortion by category", () => {
  it("should give a typical burger of 200 g for an OFF hamburger", () => {
    expect(
      estimatedPortion({ basis: "per_100g", kcal: 250, categoriesTags: ["en:hamburgers"] }),
    ).toEqual({ label: "1 typical burger", grams: 200, ml: null, isDefault: true });
  });

  it("should let the burger win when a product is also a sandwich", () => {
    expect(
      estimatedPortion({
        basis: "per_100g",
        kcal: 250,
        categoriesTags: ["en:sandwiches", "en:hamburgers"],
      }).label,
    ).toBe("1 typical burger");
  });

  it("should give a typical sandwich of 200 g", () => {
    expect(
      estimatedPortion({ basis: "per_100g", kcal: 230, categoriesTags: ["en:sandwiches"] }),
    ).toMatchObject({ label: "1 typical sandwich", grams: 200 });
  });

  it("should match on the CoFID group when there are no tags", () => {
    expect(estimatedPortion({ basis: "per_100g", kcal: 300, foodGroup: "AG" })).toMatchObject({
      label: "1 typical roll",
      grams: 60,
    });
  });

  it("should read only the first two letters of the CoFID group", () => {
    expect(estimatedPortion({ basis: "per_100g", kcal: 300, foodGroup: "AG1" })).toMatchObject({
      label: "1 typical roll",
    });
  });

  it("should match a one letter CoFID group", () => {
    expect(estimatedPortion({ basis: "per_100g", kcal: 300, foodGroup: "G" })).toMatchObject({
      label: "1 typical serving",
      grams: 30,
    });
  });

  it("should use the dry size of rice at 250 kcal per 100 g or more", () => {
    expect(
      estimatedPortion({ basis: "per_100g", kcal: 360, categoriesTags: ["en:rices"] }),
    ).toMatchObject({ grams: 75 });
  });

  it("should use the cooked size of rice below 250 kcal per 100 g", () => {
    expect(
      estimatedPortion({ basis: "per_100g", kcal: 130, categoriesTags: ["en:rices"] }),
    ).toMatchObject({ grams: 180 });
  });

  it("should use the dry size of legumes at 250 kcal per 100 g and the cooked size below", () => {
    expect(estimatedPortion({ basis: "per_100g", kcal: 300, foodGroup: "DB" }).grams).toBe(60);
    expect(estimatedPortion({ basis: "per_100g", kcal: 100, foodGroup: "DB" }).grams).toBe(120);
  });

  it("should give a glass of milk in millilitres for a drink", () => {
    expect(
      estimatedPortion({ basis: "per_100ml", kcal: 46, categoriesTags: ["en:milks"] }),
    ).toEqual({ label: "1 typical glass", grams: null, ml: 200, isDefault: true });
  });

  it("should give the size in the food's own basis", () => {
    expect(
      estimatedPortion({ basis: "per_100ml", kcal: 46, categoriesTags: ["en:milks"] }).grams,
    ).toBeNull();
    expect(
      estimatedPortion({ basis: "per_100g", kcal: 46, categoriesTags: ["en:milks"] }).ml,
    ).toBeNull();
  });

  it("should take the first matching row when two tags are present", () => {
    expect(
      estimatedPortion({
        basis: "per_100g",
        kcal: 400,
        categoriesTags: ["en:breads", "en:biscuits"],
      }),
    ).toMatchObject({ label: "1 typical serving", grams: 50 });
  });

  it("should give every row a positive size", () => {
    for (const row of ESTIMATE_CATEGORY_ROWS) {
      const sizes = typeof row.size === "number" ? [row.size] : [row.size.dry, row.size.cooked];
      expect(sizes.every((size) => size > 0)).toBe(true);
    }
  });
});

describe("estimatedPortion by energy", () => {
  it.each([
    [0, 5],
    [4.9, 5],
    [5, 80],
    [59.9, 80],
    [60, 150],
    [149.9, 150],
    [150, 100],
    [299.9, 100],
    [300, 40],
    [449.9, 40],
    [450, 30],
    [699.9, 30],
    [700, 15],
    [900, 15],
  ])("should give a per 100 g food of %s kcal %s g", (kcal, grams) => {
    expect(estimatedPortion({ basis: "per_100g", kcal })).toEqual({
      label: "1 typical serving",
      grams,
      ml: null,
      isDefault: true,
    });
  });

  it.each([
    [0, 200],
    [99.9, 200],
    [100, 30],
    [499.9, 30],
    [500, 15],
  ])("should give a per 100 ml food of %s kcal %s ml", (kcal, ml) => {
    expect(estimatedPortion({ basis: "per_100ml", kcal })).toEqual({
      label: "1 typical serving",
      grams: null,
      ml,
      isDefault: true,
    });
  });

  it("should give 100 g when the energy is unknown", () => {
    expect(estimatedPortion({ basis: "per_100g", kcal: null })).toEqual({
      label: "1 typical serving",
      grams: 100,
      ml: null,
      isDefault: true,
    });
  });

  it("should give 100 ml of a drink when the energy is unknown", () => {
    expect(estimatedPortion({ basis: "per_100ml", kcal: null })).toEqual({
      label: "1 typical serving",
      grams: null,
      ml: 100,
      isDefault: true,
    });
  });

  it("should fall to the energy when the tags match no row", () => {
    expect(
      estimatedPortion({ basis: "per_100g", kcal: 500, categoriesTags: ["en:snacks"] }),
    ).toMatchObject({ grams: 30 });
  });

  it("should keep the bands as plain ascending lower bounds that survive JSON", () => {
    for (const bands of [ESTIMATE_ENERGY_BANDS_PER_100G, ESTIMATE_ENERGY_BANDS_PER_100ML]) {
      const roundTripped: unknown = JSON.parse(JSON.stringify(bands));

      expect(roundTripped).toEqual(bands);
      expect(bands[0]?.from).toBe(0);
      expect(bands.map(({ from }) => from)).toEqual(
        [...bands.map(({ from }) => from)].sort((first, second) => first - second),
      );
    }
  });
});

describe("estimatedPortionLabel", () => {
  it("should write 1 typical and the noun, and be recognised by isEstimatedPortion", () => {
    expect(estimatedPortionLabel("burger")).toBe("1 typical burger");
    expect(isEstimatedPortion(estimatedPortionLabel(ESTIMATE_GENERIC_NOUN))).toBe(true);
    expect(estimatedPortionLabel(ESTIMATE_GENERIC_NOUN)).toBe("1 typical serving");
  });
});
