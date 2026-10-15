import { describe, expect, it } from "vitest";

import { defaultServing } from "../../../src/diary/rules";
import { buildFood, buildFoodPortion } from "../../../src/testing";

const banana = buildFood({
  id: "00000000-0000-4000-8000-0000000000c1",
  name: "Banana",
  kcal: 95,
  protein_g: 1.2,
  fat_g: 0.1,
  carbs_g: 20.3,
  fibre_g: null,
});

describe("defaultServing", () => {
  it("should be the default portion, once, with the nutrients for it", () => {
    const medium = buildFoodPortion({
      food_id: banana.id,
      label: "medium",
      grams: 100,
      is_default: true,
    });
    const large = buildFoodPortion({
      food_id: banana.id,
      label: "large",
      grams: 150,
      is_default: false,
    });

    const serving = defaultServing(banana, [large, medium]);

    expect(serving.quantity).toBe(1);
    expect(serving.unit).toBe("portion");
    expect(serving.portion).toBe(medium);
    expect(serving.resolvedGrams).toBe(100);
    expect(serving.nutrients).toMatchObject({
      kcal: 95,
      protein_g: 1.2,
      fat_g: 0.1,
      carbs_g: 20.3,
    });
  });

  it("should scale the nutrients by the portion's size", () => {
    const pot = buildFoodPortion({
      food_id: banana.id,
      label: "pot",
      grams: 170,
      is_default: true,
    });

    const serving = defaultServing(banana, [pot]);

    expect(serving.nutrients.kcal).toBeCloseTo(95 * 1.7, 10);
    expect(serving.nutrients.protein_g).toBeCloseTo(1.2 * 1.7, 10);
  });

  it("should be 100 g when the food has no portions", () => {
    const serving = defaultServing(banana, []);

    expect(serving.quantity).toBe(100);
    expect(serving.unit).toBe("g");
    expect(serving.portion).toBeNull();
    expect(serving.resolvedGrams).toBe(100);
    expect(serving.nutrients).toMatchObject({
      kcal: 95,
      protein_g: 1.2,
      fat_g: 0.1,
      carbs_g: 20.3,
    });
  });

  it("should be 100 g when no portion is marked as the default", () => {
    const large = buildFoodPortion({
      food_id: banana.id,
      label: "large",
      grams: 150,
      is_default: false,
    });

    const serving = defaultServing(banana, [large]);

    expect(serving.unit).toBe("g");
    expect(serving.quantity).toBe(100);
  });

  it("should keep an unknown nutrient unknown, never 0", () => {
    const mystery = buildFood({ id: banana.id, name: "Mystery", kcal: 120, protein_g: null });

    const serving = defaultServing(mystery, []);

    expect(serving.nutrients.protein_g).toBeNull();
    expect(serving.nutrients.kcal).toBe(120);
  });

  it("should take a millilitre portion of a liquid in millilitres", () => {
    const milk = buildFood({
      id: "00000000-0000-4000-8000-0000000000c2",
      name: "Milk",
      basis: "per_100ml",
      density_g_per_ml: 1.03,
      kcal: 46,
    });
    const glass = buildFoodPortion({
      food_id: milk.id,
      label: "glass",
      ml: 200,
      grams: null,
      is_default: true,
    });

    const serving = defaultServing(milk, [glass]);

    expect(serving.nutrients.kcal).toBeCloseTo(92, 10);
    expect(serving.resolvedGrams).toBeCloseTo(206, 10);
  });
});
