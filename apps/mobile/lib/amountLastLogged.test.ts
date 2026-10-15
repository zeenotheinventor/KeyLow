import { SNAPSHOT_VERSION } from "@keylow/core/diary";
import { buildFoodPortion } from "@keylow/core/testing";

import { amountLastLogged, amountForPicker } from "./amountLastLogged";

import type { RecentFood } from "@keylow/api-client";
import type { FoodSnapshot } from "@keylow/core/diary";

const foodId = "00000000-0000-4000-8000-000000000001";
const medium = buildFoodPortion({ id: "portion-medium", label: "1 medium", grams: 100 });

function recentOf(
  snapshot: Partial<FoodSnapshot> & Pick<FoodSnapshot, "quantity" | "unit">,
  portionId: string | null = null,
): RecentFood {
  return {
    foodId,
    entryId: "entry-1",
    loggedAt: "2026-10-14T11:00:00Z",
    portionId,
    snapshot: {
      v: SNAPSHOT_VERSION,
      kind: "food",
      ref: foodId,
      name: "Oats",
      basis: "per_100g",
      per100: { kcal: 374, protein_g: 11, fat_g: 8, carbs_g: 60, fibre_g: null },
      portion: null,
      density: null,
      resolvedGrams: snapshot.quantity,
      engineVersion: 1,
      ...snapshot,
    },
  };
}

describe("amountLastLogged", () => {
  it("should be the grams or millilitres that were logged", () => {
    expect(amountLastLogged(recentOf({ quantity: 50, unit: "g" }), [])).toEqual({
      quantity: 50,
      unit: "g",
    });
    expect(amountLastLogged(recentOf({ quantity: 250, unit: "ml" }), [])).toEqual({
      quantity: 250,
      unit: "ml",
    });
  });

  it("should keep ounces as they were logged", () => {
    expect(amountLastLogged(recentOf({ quantity: 2, unit: "oz" }), [])).toEqual({
      quantity: 2,
      unit: "oz",
    });
  });

  it("should be the same count of the portion the entry points to while it is still there", () => {
    const recent = recentOf(
      { quantity: 2, unit: "portion", portion: { label: "1 medium", grams: 100 } },
      "portion-medium",
    );

    expect(amountLastLogged(recent, [medium])).toEqual({
      quantity: 2,
      unit: "portion",
      portion: medium,
    });
  });

  it("should fall back to the grams the portion came to once the portion is gone", () => {
    const recent = recentOf(
      { quantity: 2, unit: "portion", portion: { label: "1 medium", grams: 100 } },
      "portion-removed",
    );

    expect(amountLastLogged(recent, [])).toEqual({ quantity: 200, unit: "g" });
  });
});

describe("amountForPicker", () => {
  it("should hand the picker grams, millilitres and portions as they are", () => {
    expect(amountForPicker({ quantity: 50, unit: "g" })).toEqual({ quantity: 50, unit: "g" });
    expect(amountForPicker({ quantity: 2, unit: "portion", portion: medium })).toEqual({
      quantity: 2,
      unit: "portion",
      portion: medium,
    });
  });

  it("should turn ounces into grams and fluid ounces into millilitres, which the picker has", () => {
    expect(amountForPicker({ quantity: 2, unit: "oz" })).toEqual({ quantity: 56.7, unit: "g" });
    expect(amountForPicker({ quantity: 8, unit: "fl_oz" })).toEqual({
      quantity: 236.6,
      unit: "ml",
    });
  });
});
