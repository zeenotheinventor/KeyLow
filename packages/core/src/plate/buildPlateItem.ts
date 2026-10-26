import { plateValuesOf } from "./plateValues";
import { amountInPickerUnits } from "../diary/amountInPickerUnits";
import { previewAmount } from "../diary/previewAmount";
import { previewRecipeAmount, recipeAmountStart } from "../diary/previewRecipeAmount";
import { nutrientsOfSnapshot } from "../diary/snapshotQuantity";
import { unitValueOf } from "../diary/startingAmount";
import { servingOfSearchHit } from "../search/servingOfSearchHit";

import type { PlateFoodItem, PlateFoodUnit, PlateRecipeItem, PlateValues } from "./types";
import type { AmountFood, AmountPortion, ChosenAmount } from "../diary/previewAmount";
import type { LoggableRecipe, RecipeAmount } from "../diary/recipeSnapshotQuantity";
import type { FoodSnapshot } from "../diary/schemas";
import type { ServingSource } from "../search/servingOfSearchHit";

/** The part of a search result row a plate item is made from. */
export type PlateHit = ServingSource & { id: string; name: string };

const NO_VALUES: PlateValues = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

const sizeOf = (portion: AmountPortion): { amount: number; unit: "g" | "ml" } =>
  portion.grams === null
    ? { amount: portion.ml ?? 0, unit: "ml" }
    : { amount: portion.grams, unit: "g" };

function foodItem(
  key: string,
  food: { id: string; name: string },
  amount: { quantity: number; unit: PlateFoodUnit },
  perUnit: PlateValues,
): PlateFoodItem {
  return {
    kind: "food",
    key,
    foodId: food.id,
    name: food.name,
    quantityText: String(amount.quantity),
    quantity: amount.quantity,
    unit: amount.unit,
    perUnit,
  };
}

/**
 * The plate item a result row's plus adds: the serving the row shows (`servingOfSearchHit`), one of the
 * default portion or 100 g or 100 ml, with the values for one of its unit.
 */
export function plateItemOfHit(key: string, hit: PlateHit): PlateFoodItem {
  const serving = servingOfSearchHit(hit);
  const perServing = plateValuesOf(serving);
  const perUnit = {
    kcal: perServing.kcal / serving.quantity,
    protein_g: perServing.protein_g / serving.quantity,
    carbs_g: perServing.carbs_g / serving.quantity,
    fat_g: perServing.fat_g / serving.quantity,
  };
  // A serving is a portion only when the hit has the whole of one, which is one of grams and millilitres.
  const portionSize =
    hit.default_portion_grams === null
      ? { amount: hit.default_portion_ml ?? 0, unit: "ml" as const }
      : { amount: hit.default_portion_grams, unit: "g" as const };
  const unit: PlateFoodUnit =
    serving.unit === "portion" && serving.portionId !== null && hit.default_portion_label !== null
      ? {
          kind: "portion",
          portionId: serving.portionId,
          label: hit.default_portion_label,
          size: portionSize,
        }
      : { kind: serving.unit === "ml" ? "ml" : "g" };

  return foodItem(key, hit, { quantity: serving.quantity, unit }, perUnit);
}

/** A Recent food as the plate needs it: the entry's snapshot and the portion link it used. */
export type PlateRecent = {
  foodId: string;
  /** The portion that entry used, null once the portion was replaced or when the unit was not `portion`. */
  portionId: string | null;
  snapshot: FoodSnapshot;
};

// The amount last logged, in the units the picker offers: ounces come as grams and fluid ounces as millilitres,
// and a portion with no portion on the snapshot is the grams it came to.
function lastLoggedAmount({ snapshot, portionId }: PlateRecent): {
  quantity: number;
  unit: PlateFoodUnit;
} {
  if (snapshot.unit === "portion") {
    const { portion } = snapshot;
    if (portion === null) {
      return { quantity: snapshot.resolvedGrams, unit: { kind: "g" } };
    }
    return {
      quantity: snapshot.quantity,
      unit: {
        kind: "portion",
        portionId,
        label: portion.label,
        size:
          "grams" in portion
            ? { amount: portion.grams, unit: "g" }
            : { amount: portion.ml, unit: "ml" },
      },
    };
  }
  const measured = amountInPickerUnits({ quantity: snapshot.quantity, unit: snapshot.unit });

  return { quantity: measured.quantity, unit: { kind: measured.unit } };
}

/**
 * The plate item a Recent food's plus adds: the amount it was last logged with, with the values for one of
 * its unit worked out from the entry's own snapshot, so the row needs no food loaded.
 */
export function plateItemOfRecent(key: string, recent: PlateRecent): PlateFoodItem {
  const { snapshot } = recent;
  const amount = lastLoggedAmount(recent);
  const perUnit = plateValuesOf(
    nutrientsOfSnapshot({
      ...snapshot,
      quantity: 1,
      unit: amount.unit.kind,
      portion: amount.unit.kind === "portion" ? snapshot.portion : null,
    }),
  );

  return foodItem(key, { id: recent.foodId, name: snapshot.name }, amount, perUnit);
}

export type PlatePickedFood = {
  key: string;
  food: AmountFood & { id: string; name: string };
  /** Every portion the picker offered, spoons included. */
  portions: readonly AmountPortion[];
  /** The amount the picker chose (`previewAmount`'s `amount`). */
  amount: ChosenAmount;
};

/** The plate item the picker's Add to plate makes for a food: the amount it chose, with the values for one of its unit. */
export function plateItemOfPickedFood({
  key,
  food,
  portions,
  amount,
}: PlatePickedFood): PlateFoodItem {
  const forOne = previewAmount(food, portions, unitValueOf(amount), "1").hero.values;
  const unit: PlateFoodUnit =
    amount.unit === "portion"
      ? {
          kind: "portion",
          portionId: amount.portion.id,
          label: amount.portion.label,
          size: sizeOf(amount.portion),
        }
      : { kind: amount.unit };

  return foodItem(
    key,
    food,
    { quantity: amount.quantity, unit },
    forOne === null ? NO_VALUES : plateValuesOf(forOne),
  );
}

export type PlateRecipeInput = {
  key: string;
  /** A recipe the diary offers for logging (`canLogRecipe`). */
  recipe: LoggableRecipe;
  /** What the picker chose. A recipe row's plus leaves it out, and it is one serving. */
  amount?: RecipeAmount;
};

/** The plate item for a recipe: one serving from a result row, or the amount the recipe picker chose. */
export function plateItemOfRecipe({
  key,
  recipe,
  amount = recipeAmountStart(),
}: PlateRecipeInput): PlateRecipeItem {
  const forOne = previewRecipeAmount(recipe, { quantity: 1, unit: amount.unit });

  return {
    kind: "recipe",
    key,
    recipe,
    quantityText: String(amount.quantity),
    quantity: amount.quantity,
    unit: amount.unit,
    perUnit: forOne === null ? NO_VALUES : plateValuesOf(forOne),
  };
}
