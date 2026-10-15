import { describe, expect, it } from "vitest";

import { buildFoodSnapshot } from "../../src/diary/buildFoodSnapshot";
import { foodOfSnapshot } from "../../src/diary/foodOfSnapshot";
import { foodRowSchema } from "../../src/schemas/food";
import { buildFood } from "../../src/testing";

const milk = buildFood({
  id: "00000000-0000-4000-8000-0000000000e1",
  name: "Semi-skimmed milk",
  basis: "per_100ml",
  density_g_per_ml: 1.03,
  kcal: 46,
  protein_g: 3.5,
  fat_g: 1.7,
  carbs_g: 4.7,
  salt_g: 0.1,
});
const snapshot = buildFoodSnapshot(milk, { quantity: 200, unit: "ml" });

describe("foodOfSnapshot", () => {
  it("should give back the food as it was when it was logged", () => {
    const food = foodOfSnapshot(snapshot, "2026-10-15T12:40:00+00:00");

    expect(food).toMatchObject({
      id: milk.id,
      name: "Semi-skimmed milk",
      basis: "per_100ml",
      density_g_per_ml: 1.03,
      kcal: 46,
      protein_g: 3.5,
      fat_g: 1.7,
      carbs_g: 4.7,
      fibre_g: null,
      salt_g: 0.1,
      sat_fat_g: null,
      sugars_g: null,
    });
  });

  it("should be a whole food row, so a screen that draws a food can draw an entry", () => {
    const food = foodOfSnapshot(snapshot, "2026-10-15T12:40:00+00:00");

    expect(foodRowSchema.safeParse(food).success).toBe(true);
  });

  it("should take nothing from the live food: it carries no flag that asks for a review", () => {
    const food = foodOfSnapshot(snapshot, "2026-10-15T12:40:00+00:00");

    expect(food.quality).toEqual({});
    expect(food.deleted_at).toBeNull();
  });

  it("should leave a value the snapshot never held as null, never 0", () => {
    const bare = foodOfSnapshot(
      {
        ...snapshot,
        per100: { kcal: 46, protein_g: null, fat_g: null, carbs_g: null, fibre_g: null },
      },
      "2026-10-15T12:40:00+00:00",
    );

    expect(bare.protein_g).toBeNull();
    expect(bare.carbs_g).toBeNull();
  });
});
