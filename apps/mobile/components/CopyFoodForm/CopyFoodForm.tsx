import { useFood, useFoodPortions } from "@keylow/api-client";
import { normaliseBarcode } from "@keylow/core/foods";

import { foodToFormValues } from "../FoodForm";
import { FoodLoadState } from "../FoodLoadState";
import { NewFoodForm } from "../NewFoodForm";

import type { CopyFoodFormProps } from "./types";

const US_TOTAL_CARBOHYDRATE_NOTE =
  "This product's carbohydrate included fibre. Enter the carbohydrate without fibre.";

/** A new food form filled in from an existing food. Saving creates a new food of the user's own. */
export function CopyFoodForm({ sourceFoodId }: CopyFoodFormProps) {
  const food = useFood(sourceFoodId);
  const portions = useFoodPortions(sourceFoodId);

  // A refresh that fails while the food is on show must not replace a form the user is filling in.
  if (
    (food.isError && food.data === undefined) ||
    (portions.isError && portions.data === undefined)
  ) {
    return <FoodLoadState state="error" />;
  }

  if (food.isPending || portions.isPending) {
    return <FoodLoadState state="loading" />;
  }

  if (food.data === null) {
    return <FoodLoadState state="notFound" />;
  }

  // The barcode is kept as it is when it is valid. An invalid one stays editable so it can be fixed.
  const isBarcodeKept = food.data.barcode !== null && normaliseBarcode(food.data.barcode).ok;

  // A US label's carbohydrate includes fibre. It is never converted here: the field stays blank so
  // the user must enter the value without fibre.
  const isCarbohydrateUsTotal = food.data.quality.carbs_convention === "us_total";
  const copiedValues = foodToFormValues(food.data, portions.data);

  return (
    <NewFoodForm
      submitLabel="Save as my food"
      initialValues={isCarbohydrateUsTotal ? { ...copiedValues, carbs_g: "" } : copiedValues}
      {...(isCarbohydrateUsTotal ? { nutrientNote: US_TOTAL_CARBOHYDRATE_NOTE } : {})}
      isBarcodeLocked={isBarcodeKept}
      lockedBarcodeHint="Kept from the product you are copying"
    />
  );
}
