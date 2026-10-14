import { FOOD_FORM_BUTTONS } from "@keylow/core/copy";
import { isFoodId, normaliseBarcode } from "@keylow/core/foods";
import { useLocalSearchParams } from "expo-router";

import { CopyFoodForm } from "../../components/CopyFoodForm";
import { emptyFoodFormValues } from "../../components/FoodForm";
import { FoodLoadState } from "../../components/FoodLoadState";
import { NewFoodForm } from "../../components/NewFoodForm";

// A repeated route parameter arrives as an array, so the first value is used. An empty one is none.
function firstParameter(parameter: string | string[] | undefined): string | undefined {
  const first = Array.isArray(parameter) ? parameter[0] : parameter;
  return first === undefined || first === "" ? undefined : first;
}

export default function NewFoodRoute() {
  const { barcode, from } = useLocalSearchParams<{
    barcode?: string | string[];
    from?: string | string[];
  }>();
  const sourceFoodId = firstParameter(from);
  // A scanned barcode arrives as a route parameter. The form's schema canonicalises it on save.
  const scannedBarcode = firstParameter(barcode);

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
    />
  );
}
