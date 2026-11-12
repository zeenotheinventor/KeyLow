import { describe, expect, it } from "vitest";

import { describeLoggedAmount } from "../../src/copy";
import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { previewAmount } from "../../src/diary/previewAmount";
import { normaliseOffProduct } from "../../src/foods/off";
import { servingOfSearchHit } from "../../src/search";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { FoodPortion } from "../../src/schemas/food";

// A jam whose serving is the placeholder 100 g, so it opens on an estimate of 15 g.
const result = normaliseOffProduct({
  code: "5000000010011",
  product_name: "Strawberry jam",
  quantity: "370 g",
  serving_size: "1 serving (100 g)",
  serving_quantity: 100,
  categories_tags: ["en:spreads", "en:jams"],
  nutriments: { "energy-kcal_100g": 250, proteins_100g: 0.5, fat_100g: 0, carbohydrates_100g: 60 },
});
if (!result.ok) {
  throw new Error("The product must normalise");
}
const food = buildFood({ ...result.food, source: "off", source_ref: result.food.barcode });
const portions: FoodPortion[] = result.portions.map((portion, position) =>
  buildFoodPortion({
    id: `portion-${position}`,
    label: portion.label,
    grams: portion.grams,
    ml: portion.ml,
    is_default: portion.isDefault,
    position,
  }),
);
const defaultPortion = portions.find((portion) => portion.is_default);
if (defaultPortion === undefined) {
  throw new Error("The food must have a default portion");
}
const when = { loggedAt: "2026-11-10T12:30:00+00:00", localDate: "2026-11-10" };

describe("the figures of an estimated default", () => {
  const row = servingOfSearchHit({
    ...food,
    default_portion_id: defaultPortion.id,
    default_portion_label: defaultPortion.label,
    default_portion_grams: defaultPortion.grams,
    default_portion_ml: defaultPortion.ml,
  });
  const { hero } = previewAmount(food, portions, defaultPortion.id, "1");
  const entry = buildLogEntry({
    food,
    quantity: 1,
    unit: "portion",
    portion: defaultPortion,
    foodPortions: portions,
    ...when,
  });

  it("should be 1 typical serving of 15 g", () => {
    expect(defaultPortion).toMatchObject({ label: "1 typical serving", grams: 15 });
  });

  it("should give the row, the hero and the logged entry the same figures", () => {
    const figures = { kcal: 37.5, protein_g: 0.075, fat_g: 0, carbs_g: 9 };

    expect(row).toMatchObject(figures);
    expect(hero.values).toEqual(figures);
    expect(entry.nutrients).toMatchObject(figures);
  });

  it("should say about on the row, the hero and the diary row", () => {
    expect(row.caption).toBe("1 typical serving (about 15 g)");
    expect(hero.caption).toBe("For 1 typical serving (about 15 g)");
    expect(
      describeLoggedAmount({
        unit: "portion",
        quantity: 1,
        resolvedGrams: entry.resolved_grams,
        portion: { label: defaultPortion.label, grams: 15 },
      }),
    ).toBe("1 typical serving (about 15 g)");
  });
});
