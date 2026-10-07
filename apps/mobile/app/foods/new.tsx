import { FoodsPartialWriteError, useCreateFood, useUpdateFood } from "@keylow/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { FoodForm, emptyFoodFormValues } from "../../components/FoodForm";

import type { CustomFoodInput } from "@keylow/core/schemas";

export default function NewFoodRoute() {
  const router = useRouter();
  const { barcode } = useLocalSearchParams<{ barcode?: string | string[] }>();
  const createFood = useCreateFood();
  const updateFood = useUpdateFood();
  // Set when a create saved the food but not its portions. Later saves then update that food, so
  // the user cannot create it a second time.
  const [partiallySavedFoodId, setPartiallySavedFoodId] = useState<string | undefined>(undefined);

  // A scanned barcode arrives as a route parameter. The form's schema canonicalises it on save.
  // A repeated parameter arrives as an array, so the first value is used.
  const firstBarcode = Array.isArray(barcode) ? barcode[0] : barcode;
  const scannedBarcode =
    firstBarcode === undefined || firstBarcode === "" ? undefined : firstBarcode;

  async function create(input: CustomFoodInput) {
    try {
      const created = await createFood.mutateAsync(input);
      router.replace(`/foods/${created.food.id}`);
    } catch (error) {
      if (error instanceof FoodsPartialWriteError) {
        setPartiallySavedFoodId(error.foodId);
      }
      throw error;
    }
  }

  async function update(id: string, input: CustomFoodInput) {
    await updateFood.mutateAsync({ id, input });
    router.replace(`/foods/${id}`);
  }

  async function save(input: CustomFoodInput) {
    if (partiallySavedFoodId === undefined) {
      await create(input);
    } else {
      await update(partiallySavedFoodId, input);
    }
  }

  return (
    <FoodForm
      submitLabel={partiallySavedFoodId === undefined ? "Create food" : "Save"}
      initialValues={{ ...emptyFoodFormValues, barcode: scannedBarcode ?? "" }}
      isBarcodeLocked={scannedBarcode !== undefined}
      onSubmit={save}
    />
  );
}
