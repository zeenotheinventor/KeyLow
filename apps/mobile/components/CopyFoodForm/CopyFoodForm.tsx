import { useFoodWithPortions } from "@keylow/api-client";
import { FOOD_FORM, FOOD_FORM_BUTTONS } from "@keylow/core/copy";
import { copyFormStart, normaliseBarcode } from "@keylow/core/foods";

import { foodToFormValues } from "../FoodForm";
import { FoodLoadState } from "../FoodLoadState";
import { NewFoodForm } from "../NewFoodForm";

import type { CopyFoodFormProps } from "./types";

/** A new food form filled in from an existing food. Saving creates a new food of the user's own. */
export function CopyFoodForm({ sourceFoodId }: CopyFoodFormProps) {
  const state = useFoodWithPortions(sourceFoodId);

  if (state.status !== "ready") {
    return <FoodLoadState state={state.status} />;
  }

  const { food, portions } = state;

  // The barcode is kept as it is when it is valid. An invalid one stays editable so it can be fixed.
  const isBarcodeKept = food.barcode !== null && normaliseBarcode(food.barcode).ok;

  const { fields, notGiven, isCarbsIncludingFibre } = copyFormStart(food);
  const initialValues = { ...foodToFormValues(food, portions), ...fields };

  return (
    <NewFoodForm
      submitLabel={FOOD_FORM_BUTTONS.copy}
      initialValues={initialValues}
      {...(isCarbsIncludingFibre ? { nutrientNote: FOOD_FORM.usCarbsNote } : {})}
      notGivenNutrients={notGiven}
      isBarcodeLocked={isBarcodeKept}
      lockedBarcodeHint={FOOD_FORM.barcodeFromCopy}
    />
  );
}
