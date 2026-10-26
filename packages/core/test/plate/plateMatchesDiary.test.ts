import { describe, expect, it } from "vitest";

import { banana, chickenAndRice, greekYoghurt, semiSkimmedMilk } from "./sample";
import { buildLogEntry, buildRecipeLogEntry } from "../../src/diary";
import { sumEntries } from "../../src/diary/rules";
import {
  plateFoodAmount,
  plateItemOfHit,
  plateItemOfRecipe,
  plateTotals,
  setPlateQuantity,
} from "../../src/plate";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { PlateHit, PlateItem } from "../../src/plate";

const when = { loggedAt: "2026-10-26T18:30:00+00:00", localDate: "2026-10-26" };

// The board "plate · open": Chicken and rice 1 serving, Greek yoghurt 1 pot, Banana 1 medium, Semi-skimmed
// milk 200 ml.
const openPlate = (): PlateItem[] =>
  setPlateQuantity(
    [
      plateItemOfRecipe({ key: "recipe", recipe: chickenAndRice }),
      plateItemOfHit("yoghurt", greekYoghurt),
      plateItemOfHit("banana", banana),
      plateItemOfHit("milk", semiSkimmedMilk),
    ],
    "milk",
    "200",
  );

// The food a search hit stands for, and its default portion when it has one.
const foodOfHit = (hit: PlateHit) =>
  buildFood({
    id: hit.id,
    name: hit.name,
    basis: hit.basis,
    kcal: hit.kcal,
    protein_g: hit.protein_g,
    carbs_g: hit.carbs_g,
    fat_g: hit.fat_g,
  });

const portionsOfHit = (hit: PlateHit) =>
  hit.default_portion_id === null
    ? []
    : [
        buildFoodPortion({
          id: hit.default_portion_id,
          food_id: hit.id,
          label: hit.default_portion_label ?? "",
          grams: hit.default_portion_grams,
          ml: hit.default_portion_ml,
          is_default: true,
        }),
      ];

const hitsByFoodId = new Map([greekYoghurt, banana, semiSkimmedMilk].map((hit) => [hit.id, hit]));

// The entry the plate logs for a row, built the way the mobile log does: the amount `plateFoodAmount` resolves
// against the food as it is, then `buildLogEntry` (or `buildRecipeLogEntry` for a recipe).
function entryOfRow(item: PlateItem) {
  if (item.kind === "recipe") {
    return buildRecipeLogEntry({
      recipe: item.recipe,
      quantity: item.quantity,
      unit: item.unit,
      ...when,
    });
  }
  const hit = hitsByFoodId.get(item.foodId);
  if (hit === undefined) {
    throw new Error("The row's food must be one of the sample hits");
  }
  const portions = portionsOfHit(hit);
  const amount = plateFoodAmount(item, portions);
  if (amount === undefined) {
    throw new Error("The row's amount must be valid");
  }

  return buildLogEntry({
    food: foodOfHit(hit),
    quantity: amount.quantity,
    unit: amount.unit,
    ...(amount.unit === "portion" ? { portion: amount.portion } : {}),
    foodPortions: portions,
    ...when,
  });
}

describe("the plate and the diary", () => {
  it("should add up in the diary to what the plate showed", () => {
    const items = openPlate();

    const inDiary = sumEntries(items.map(entryOfRow));
    const onPlate = plateTotals(items);

    expect(inDiary.kcal).toBeCloseTo(onPlate.kcal, 3);
    expect(inDiary.protein_g).toBeCloseTo(onPlate.protein_g, 3);
    expect(inDiary.carbs_g).toBeCloseTo(onPlate.carbs_g, 3);
    expect(inDiary.fat_g).toBeCloseTo(onPlate.fat_g, 3);
  });
});
