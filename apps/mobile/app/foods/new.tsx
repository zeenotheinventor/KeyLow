import { useLocalSearchParams } from "expo-router";

import { CopyFoodForm } from "../../components/CopyFoodForm";
import { emptyFoodFormValues } from "../../components/FoodForm";
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
    return <CopyFoodForm sourceFoodId={sourceFoodId} />;
  }

  return (
    <NewFoodForm
      submitLabel="Create food"
      initialValues={{ ...emptyFoodFormValues, barcode: scannedBarcode ?? "" }}
      isBarcodeLocked={scannedBarcode !== undefined}
    />
  );
}
