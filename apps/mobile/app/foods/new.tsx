import { FOOD_FORM_BUTTONS } from "@keylow/core/copy";
import { isFoodId, normaliseBarcode } from "@keylow/core/foods";
import { useLocalSearchParams } from "expo-router";

import { CopyFoodForm } from "../../components/CopyFoodForm";
import { emptyFoodFormValues } from "../../components/FoodForm";
import { FoodLoadState } from "../../components/FoodLoadState";
import { NewFoodForm } from "../../components/NewFoodForm";
import { readIngredientRequestId, readLogContext } from "../../lib/navigation";

// A repeated route parameter arrives as an array, so the first value is used. An empty one is none.
function firstParameter(parameter: string | string[] | undefined): string | undefined {
  const first = Array.isArray(parameter) ? parameter[0] : parameter;
  return first === undefined || first === "" ? undefined : first;
}

export default function NewFoodRoute() {
  const { barcode, from, day, time, ingredient } = useLocalSearchParams<{
    barcode?: string | string[];
    from?: string | string[];
    ingredient?: string | string[];
    day?: string | string[];
    time?: string | string[];
  }>();
  const sourceFoodId = firstParameter(from);
  // A scanned barcode arrives as a route parameter. The form's schema canonicalises it on save.
  const scannedBarcode = firstParameter(barcode);
  // A scan from the recipe editor carries its request, and then the saved food goes back to the editor and
  // not to the diary, so the day and the time are not read.
  const ingredientRequestId = readIngredientRequestId(ingredient);

  if (sourceFoodId !== undefined) {
    // A value that is not a food id is a food that is not there, so it is never asked for.
    if (!isFoodId(sourceFoodId)) {
      return <FoodLoadState state="notFound" />;
    }

    return <CopyFoodForm sourceFoodId={sourceFoodId} />;
  }

  return (
    <NewFoodForm
      submitLabel={FOOD_FORM_BUTTONS.create}
      initialValues={{ ...emptyFoodFormValues, barcode: scannedBarcode ?? "" }}
      // A code that is not valid stays editable, or the user could not fix it.
      isBarcodeLocked={scannedBarcode !== undefined && normaliseBarcode(scannedBarcode).ok}
      // A scan in the diary carries the day and the time it began on, so the new food opens its portion picker on them.
      {...(scannedBarcode === undefined
        ? {}
        : {
            fromScan: {
              barcode: scannedBarcode,
              continueTo:
                ingredientRequestId === undefined
                  ? { kind: "log", logContext: readLogContext({ day, time }) }
                  : { kind: "ingredient", requestId: ingredientRequestId },
            },
          })}
    />
  );
}
