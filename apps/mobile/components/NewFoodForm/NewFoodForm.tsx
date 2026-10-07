import { FoodsPartialWriteError, useCreateFood, useUpdateFood } from "@keylow/api-client";
import { useRouter } from "expo-router";
import { useState } from "react";

import { FoodForm } from "../FoodForm";

import type { NewFoodFormProps } from "./types";
import type { CustomFoodInput } from "@keylow/core/schemas";

/** The food form for a new food. Saving creates a food of the user's own and opens it. */
export function NewFoodForm({
  initialValues,
  isBarcodeLocked,
  lockedBarcodeHint,
  nutrientNote,
  submitLabel,
}: NewFoodFormProps) {
  const router = useRouter();
  const createFood = useCreateFood();
  const updateFood = useUpdateFood();
  // Set when a create saved the food but not its portions. Later saves then update that food, so
  // the user cannot create it a second time.
  const [partiallySavedFoodId, setPartiallySavedFoodId] = useState<string | undefined>(undefined);

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
      submitLabel={partiallySavedFoodId === undefined ? submitLabel : "Save"}
      initialValues={initialValues}
      isBarcodeLocked={isBarcodeLocked}
      {...(lockedBarcodeHint === undefined ? {} : { lockedBarcodeHint })}
      {...(nutrientNote === undefined ? {} : { nutrientNote })}
      onSubmit={save}
    />
  );
}
