import { describe, expect, it } from "vitest";

import { chickenAndRice, greekYoghurt, semiSkimmedMilk } from "./sample";
import {
  plateFoodRowStart,
  plateItemOfHit,
  plateItemOfRecipe,
  plateRecipeOfRow,
  plateRecipeRowStart,
  setPlateQuantity,
} from "../../src/plate";
import { buildFoodPortion } from "../../src/testing";

import type { PlateFoodItem, PlateRecipeItem } from "../../src/plate";

const pot = buildFoodPortion({
  id: greekYoghurt.default_portion_id ?? "",
  label: "1 pot",
  grams: 170,
});

function foodRow(text: string): PlateFoodItem {
  const [item] = setPlateQuantity([plateItemOfHit("pot", greekYoghurt)], "pot", text);
  if (item === undefined || item.kind !== "food") {
    throw new Error("The sample row should be a food");
  }
  return item;
}

function recipeRow(text: string): PlateRecipeItem {
  const [item] = setPlateQuantity(
    [plateItemOfRecipe({ key: "stew", recipe: chickenAndRice })],
    "stew",
    text,
  );
  if (item === undefined || item.kind !== "recipe") {
    throw new Error("The sample row should be a recipe");
  }
  return item;
}

describe("plateFoodRowStart", () => {
  it("should start on the row's own amount and portion", () => {
    expect(plateFoodRowStart(foodRow("2"), [pot])).toEqual({
      quantity: 2,
      unit: "portion",
      portion: pot,
    });
  });

  it("should start a row with no valid amount at its unit's usual amount", () => {
    expect(plateFoodRowStart(foodRow(""), [pot])).toEqual({
      quantity: 1,
      unit: "portion",
      portion: pot,
    });
  });

  it("should start a millilitre row with no valid amount at 100 ml", () => {
    const [milk] = setPlateQuantity([plateItemOfHit("milk", semiSkimmedMilk)], "milk", "0");
    if (milk === undefined || milk.kind !== "food") {
      throw new Error("The sample row should be a food");
    }

    expect(plateFoodRowStart(milk, [])).toEqual({ quantity: 100, unit: "ml" });
  });
});

describe("plateRecipeRowStart", () => {
  it("should start on the row's own amount and unit", () => {
    expect(plateRecipeRowStart(recipeRow("3"))).toEqual({ quantity: 3, unit: "serving" });
  });

  it("should start a row with no valid amount at one serving", () => {
    expect(plateRecipeRowStart(recipeRow("-1"))).toEqual({ quantity: 1, unit: "serving" });
  });
});

describe("plateRecipeOfRow", () => {
  it("should be the recipe the row holds, with its values per 100 g worked out from its totals and cooked weight", () => {
    const recipe = plateRecipeOfRow(recipeRow("1"));

    expect(recipe.id).toBe(chickenAndRice.id);
    expect(recipe.computed.effectiveGrams).toBe(1100);
    expect(recipe.computed.per100g.kcal).toBeCloseTo((1496.8 / 1100) * 100, 6);
  });
});
