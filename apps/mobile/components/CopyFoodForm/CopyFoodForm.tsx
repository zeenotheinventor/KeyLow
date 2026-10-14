import { useFoodWithPortions } from "@keylow/api-client";
import { FOOD_FORM, FOOD_FORM_BUTTONS } from "@keylow/core/copy";
import { normaliseBarcode } from "@keylow/core/foods";

import { foodToFormValues } from "../FoodForm";
import { FoodLoadState } from "../FoodLoadState";
import { NewFoodForm } from "../NewFoodForm";

import type { CopyFoodFormProps } from "./types";
import type { NutrientFieldName } from "../FoodForm";

// The nutrients a food must have, so the ones a source leaves blank are the ones the user has to fill in.
const REQUIRED_NUTRIENTS: readonly NutrientFieldName[] = ["kcal", "protein_g", "carbs_g", "fat_g"];

/** A new food form filled in from an existing food. Saving creates a new food of the user's own. */
export function CopyFoodForm({ sourceFoodId }: CopyFoodFormProps) {
  const state = useFoodWithPortions(sourceFoodId);

  if (state.status !== "ready") {
    return <FoodLoadState state={state.status} />;
  }

  const { food, portions } = state;

  // The barcode is kept as it is when it is valid. An invalid one stays editable so it can be fixed.
  const isBarcodeKept = food.barcode !== null && normaliseBarcode(food.barcode).ok;

  // A US label's carbohydrate includes fibre. It is never converted here: the field stays blank so
  // the user must enter the value without fibre.
  const isCarbohydrateUsTotal = food.quality.carbs_convention === "us_total";
  const copiedValues = foodToFormValues(food, portions);
  const initialValues = isCarbohydrateUsTotal ? { ...copiedValues, carbs_g: "" } : copiedValues;

  return (
    <NewFoodForm
      submitLabel={FOOD_FORM_BUTTONS.copy}
      initialValues={initialValues}
      {...(isCarbohydrateUsTotal ? { nutrientNote: FOOD_FORM.usCarbsNote } : {})}
      notGivenNutrients={REQUIRED_NUTRIENTS.filter((name) => initialValues[name] === "")}
      isBarcodeLocked={isBarcodeKept}
      lockedBarcodeHint={FOOD_FORM.barcodeFromCopy}
    />
  );
}
