import { describe, expect, it } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { pickerChoices } from "../../src/diary/pickerChoices";
import { previewAmount } from "../../src/diary/previewAmount";
import { buildFood, buildFoodPortion } from "../../src/testing";

const when = { loggedAt: "2026-10-16T12:30:00+01:00", localDate: "2026-10-16" };

const slice = buildFoodPortion({
  id: "portion-slice",
  label: "1 slice",
  grams: 35,
  is_default: true,
});

const foods = {
  // Round numbers: 1 ml weighs 1 g.
  round: buildFood({ density_g_per_ml: 1, kcal: 400, protein_g: 20, fat_g: 10, carbs_g: 50 }),
  // The numbers on the boards: olive oil and semi-skimmed milk.
  oil: buildFood({ density_g_per_ml: 0.92, kcal: 899, protein_g: 0, fat_g: 99.9, carbs_g: 0 }),
  milk: buildFood({ density_g_per_ml: 1.03, kcal: 46, protein_g: 3.5, fat_g: 1.7, carbs_g: 4.7 }),
  // No density of its own: the estimate for its CoFID group is the density the entry freezes.
  estimated: buildFood({
    source: "cofid",
    source_ref: null,
    food_group: "OC",
    kcal: 899,
    fat_g: 99.9,
  }),
};

describe("the hero and the entry for the same input", () => {
  it.each([
    { food: "round", unitValue: "spoon-tsp", text: "1", caption: "For 1 tsp (5 ml, 5 g)" },
    { food: "oil", unitValue: "spoon-tbsp", text: "2", caption: "For 2 tbsp (30 ml, 28 g)" },
    { food: "milk", unitValue: "ml", text: "250", caption: "For 250 ml (258 g)" },
    { food: "round", unitValue: "portion-slice", text: "1", caption: "For 1 slice (35 g)" },
    { food: "round", unitValue: "g", text: "150", caption: "For 150 g" },
    { food: "estimated", unitValue: "spoon-tbsp", text: "2", caption: undefined },
  ] as const)(
    "should give $unitValue $text of $food the values of buildLogEntry",
    ({ food: foodName, unitValue, text, caption }) => {
      const food = foods[foodName];
      const { portions } = pickerChoices(food, [slice]);

      const { amount, hero } = previewAmount(food, portions, unitValue, text);
      if (amount === null || hero.values === null) {
        throw new Error("The amount must be valid");
      }
      const entry = buildLogEntry({
        food,
        quantity: amount.quantity,
        unit: amount.unit,
        ...(amount.unit === "portion" ? { portion: amount.portion } : {}),
        ...when,
      });

      expect(hero.values.kcal).toBe(entry.nutrients.kcal);
      expect(hero.values.protein_g).toBe(entry.nutrients.protein_g);
      expect(hero.values.fat_g).toBe(entry.nutrients.fat_g);
      expect(hero.values.carbs_g).toBe(entry.nutrients.carbs_g);
      if (caption !== undefined) {
        expect(hero.caption).toBe(caption);
      }
    },
  );

  it("should say the weight the entry froze for a food whose density is estimated", () => {
    const food = foods.estimated;
    const { portions } = pickerChoices(food, []);

    const { amount, hero } = previewAmount(food, portions, "spoon-tbsp", "2");
    if (amount === null || amount.unit !== "portion") {
      throw new Error("The amount must be a spoon");
    }
    const entry = buildLogEntry({
      food,
      quantity: 2,
      unit: "portion",
      portion: amount.portion,
      ...when,
    });

    expect(hero.caption).toBe(`For 2 tbsp (30 ml, ${Math.round(entry.resolved_grams)} g)`);
  });

  it("should write no weight for a per 100 ml food with no density, as its entry has none to freeze", () => {
    const drink = buildFood({ basis: "per_100ml", density_g_per_ml: null, kcal: 40 });
    const { portions } = pickerChoices(drink, []);

    expect(previewAmount(drink, portions, "spoon-tbsp", "2").hero.caption).toBe(
      "For 2 tbsp (30 ml)",
    );
    expect(previewAmount(drink, portions, "ml", "250").hero.caption).toBe("For 250 ml");
  });

  it("should write the weight of millilitres of a per 100 ml food that has a density", () => {
    const syrup = buildFood({ basis: "per_100ml", density_g_per_ml: 1.5, kcal: 300 });
    const { portions } = pickerChoices(syrup, []);

    expect(previewAmount(syrup, portions, "ml", "200").hero.caption).toBe("For 200 ml (300 g)");
  });

  it("should leave grams and a natural portion without a volume", () => {
    const { portions } = pickerChoices(foods.round, [slice]);

    expect(previewAmount(foods.round, portions, "portion-slice", "2").hero.caption).toBe(
      "For 2 × 1 slice (70 g)",
    );
  });

  it("should never write about or an estimate", () => {
    const { portions } = pickerChoices(foods.estimated, []);

    for (const unitValue of ["ml", "spoon-tsp", "spoon-tbsp"]) {
      expect(previewAmount(foods.estimated, portions, unitValue, "3").hero.caption).not.toMatch(
        /about|estimat|approx|~/i,
      );
    }
  });
});
