import { FoodsPartialWriteError, useCreateFood, useUpdateFood } from "@keylow/api-client";
import { FOOD_FORM, FOOD_FORM_BUTTONS } from "@keylow/core/copy";
import { withCarriedNutrients } from "@keylow/core/foods";
import { useRouter } from "expo-router";
import { useState } from "react";

import { withLogContext } from "../../lib/navigation";
import { FoodForm } from "../FoodForm";
import { FoodFormScreen } from "../FoodFormScreen";

import type { NewFoodFormProps } from "./types";
import type { CustomFoodInput } from "@keylow/core/schemas";

/**
 * The New food screen: the form for a food of the user's own, under the sheet's header. Saving creates the
 * food and opens it, or its portion picker when the form came from a scan. A save that wrote the food but
 * not its portions turns the screen into an update of that food, so saving again never makes a second one.
 */
export function NewFoodForm({
  initialValues,
  isBarcodeLocked,
  lockedBarcodeHint,
  nutrientNote,
  notGivenNutrients,
  submitLabel,
  copiedFrom,
  fromScan,
}: NewFoodFormProps) {
  const router = useRouter();
  const createFood = useCreateFood();
  const updateFood = useUpdateFood();
  // Set when a create saved the food but not its portions. Later saves then update that food, so
  // the user cannot create it a second time.
  const [partiallySavedFoodId, setPartiallySavedFoodId] = useState<string | undefined>(undefined);

  function openSavedFood(id: string) {
    router.replace(
      fromScan === undefined
        ? `/foods/${id}`
        : withLogContext(`/foods/${id}/log`, fromScan.logContext, { barcode: fromScan.barcode }),
    );
  }

  async function create(input: CustomFoodInput) {
    try {
      const created = await createFood.mutateAsync(
        copiedFrom === undefined ? input : withCarriedNutrients(copiedFrom, input),
      );
      openSavedFood(created.food.id);
    } catch (error) {
      if (error instanceof FoodsPartialWriteError) {
        setPartiallySavedFoodId(error.foodId);
      }
      throw error;
    }
  }

  async function update(id: string, input: CustomFoodInput) {
    await updateFood.mutateAsync({ id, input });
    openSavedFood(id);
  }

  async function save(input: CustomFoodInput) {
    if (partiallySavedFoodId === undefined) {
      await create(input);
    } else {
      await update(partiallySavedFoodId, input);
    }
  }

  return (
    <FoodFormScreen title={FOOD_FORM.titles.create}>
      <FoodForm
        submitLabel={partiallySavedFoodId === undefined ? submitLabel : FOOD_FORM_BUTTONS.save}
        initialValues={initialValues}
        isBarcodeLocked={isBarcodeLocked}
        {...(lockedBarcodeHint === undefined ? {} : { lockedBarcodeHint })}
        {...(nutrientNote === undefined ? {} : { nutrientNote })}
        {...(notGivenNutrients === undefined ? {} : { notGivenNutrients })}
        onSubmit={save}
      />
    </FoodFormScreen>
  );
}
