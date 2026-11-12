import { describe, expect, it } from "vitest";

import { normaliseOffCandidate, normaliseOffProduct } from "../../src/foods/off";
import { servingOfCandidate, servingOfSearchHit } from "../../src/search";
import { buildOffCandidate } from "../../src/testing";

const withPortion = (
  defaultPortion: { label: string; grams: number | null; ml: number | null } | null | undefined,
  overrides: Parameters<typeof buildOffCandidate>[0] = {},
) =>
  buildOffCandidate({
    kcal: 250,
    protein_g: 13,
    fat_g: 12,
    carbs_g: 25,
    ...overrides,
    ...(defaultPortion === undefined ? {} : { default_portion: defaultPortion }),
  });

describe("servingOfCandidate", () => {
  it("should scale the values to the default portion and name it with its size", () => {
    const serving = servingOfCandidate(withPortion({ label: "1 burger", grams: 240, ml: null }));

    expect(serving.caption).toBe("1 burger (240 g)");
    expect(serving.kcal).toBeCloseTo(600);
    expect(serving.protein_g).toBeCloseTo(31.2);
    expect(serving.fat_g).toBeCloseTo(28.8);
    expect(serving.carbs_g).toBeCloseTo(60);
  });

  it("should say an estimate is about its size", () => {
    const serving = servingOfCandidate(
      withPortion({ label: "1 typical serving", grams: 150, ml: null }),
    );

    expect(serving.caption).toBe("1 typical serving (about 150 g)");
  });

  it("should scale a portion in millilitres of a per 100 ml candidate", () => {
    const serving = servingOfCandidate(
      withPortion({ label: "1 glass", grams: null, ml: 200 }, { basis: "per_100ml", kcal: 46 }),
    );

    expect(serving.caption).toBe("1 glass (200 ml)");
    expect(serving.kcal).toBeCloseTo(92);
  });

  it("should be one of the portion, with no portion id to log by", () => {
    expect(
      servingOfCandidate(withPortion({ label: "1 burger", grams: 240, ml: null })),
    ).toMatchObject({ quantity: 1, unit: "portion", portionId: null });
  });

  it.each([
    ["is null", null],
    ["is missing", undefined],
  ])("should be 100 g of the candidate when the default portion %s", (_name, defaultPortion) => {
    const serving = servingOfCandidate(withPortion(defaultPortion));

    expect(serving).toMatchObject({ caption: "100 g", quantity: 100, unit: "g", kcal: 250 });
  });

  it("should be 100 ml of a per 100 ml candidate with no default portion", () => {
    expect(servingOfCandidate(withPortion(null, { basis: "per_100ml" }))).toMatchObject({
      caption: "100 ml",
      unit: "ml",
    });
  });

  it("should fall back to 100 g for a portion with both a weight and a volume, as a stored food does", () => {
    expect(servingOfCandidate(withPortion({ label: "1 pot", grams: 100, ml: 100 })).caption).toBe(
      "100 g",
    );
  });

  it("should keep a nutrient the product does not give as not given, never 0", () => {
    const serving = servingOfCandidate(
      withPortion({ label: "1 burger", grams: 240, ml: null }, { carbs_g: null }),
    );

    expect(serving.carbs_g).toBeNull();
  });
});

describe("a candidate and the food it becomes", () => {
  // What a search hit carries: no serving, no packaging, a pack size and the categories.
  const hits = [
    {
      name: "a pack with a quantity and no serving",
      payload: {
        code: "5000000010011",
        product_name: "Test Burger",
        quantity: "240 g",
        categories_tags: ["en:sandwiches"],
        nutriments: {
          "energy-kcal_100g": 250,
          proteins_100g: 13,
          fat_100g: 12,
          carbohydrates_100g: 25,
        },
      },
    },
    {
      name: "a product with nothing to size it by",
      payload: {
        code: "5000000010028",
        product_name: "Test Oat Drink",
        nutriments: {
          "energy-kcal_100g": 46,
          proteins_100g: 1,
          fat_100g: 1.5,
          carbohydrates_100g: 6.7,
        },
      },
    },
  ];

  it.each(hits)("should show the figures the picker opens on, for $name", ({ payload }) => {
    const candidate = normaliseOffCandidate(payload);
    const stored = normaliseOffProduct(payload);
    if (candidate === null || !stored.ok) {
      throw new Error("the payload should normalise");
    }
    const defaultPortion = stored.portions.find((portion) => portion.isDefault);

    const rowServing = servingOfCandidate(candidate);
    const pickerServing = servingOfSearchHit({
      ...stored.food,
      default_portion_id: "stored-portion-id",
      default_portion_label: defaultPortion?.label ?? null,
      default_portion_grams: defaultPortion?.grams ?? null,
      default_portion_ml: defaultPortion?.ml ?? null,
    });

    expect(rowServing).toEqual({ ...pickerServing, portionId: null });
  });
});
