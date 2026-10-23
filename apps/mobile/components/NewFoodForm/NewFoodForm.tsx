import { FoodsPartialWriteError, useCreateFood, useUpdateFood } from "@keylow/api-client";
import { FOOD_FORM, FOOD_FORM_BUTTONS } from "@keylow/core/copy";
import { withCarriedNutrients } from "@keylow/core/foods";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";

import { finishIngredientScan } from "../../lib/ingredientScan";
import { useCloseFoodsSheet, withLogContext } from "../../lib/navigation";
import { FoodForm } from "../FoodForm";
import { FoodFormScreen } from "../FoodFormScreen";

import type { NewFoodFormProps } from "./types";
import type { CustomFoodInput } from "@keylow/core/schemas";

/**
 * The New food screen: the form for a food of the user's own, under the sheet's header. Saving creates the
 * food and opens it, or its portion picker when the form came from a scan in the diary. When it came from a
 * scan in the recipe editor, the food is handed back to the editor and the whole sheet closes. A save that
 * wrote the food but not its portions turns the screen into an update of that food, so saving again never
 * makes a second one.
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
  const closeSheet = useCloseFoodsSheet();
  const createFood = useCreateFood();
  const updateFood = useUpdateFood();
  // Set when a create saved the food but not its portions. Later saves then update that food, so
  // the user cannot create it a second time.
  const [partiallySavedFoodId, setPartiallySavedFoodId] = useState<string | undefined>(undefined);

  // Set once the food was handed back to the recipe editor. The form stays mounted while the sheet slides
  // away and its Create comes back, so a late press must not save a second food or close another screen.
  const hasHandedBackRef = useRef(false);

  function continueWithSavedFood(id: string) {
    if (fromScan?.continueTo.kind === "ingredient") {
      hasHandedBackRef.current = true;
      // The recipe editor under the sheet takes the food and shows its amount step. The diary is never involved.
      finishIngredientScan(fromScan.continueTo.requestId, id);
      closeSheet();
    } else {
      router.replace(
        fromScan === undefined
          ? `/foods/${id}`
          : withLogContext(`/foods/${id}/log`, fromScan.continueTo.logContext, {
              barcode: fromScan.barcode,
            }),
      );
    }
  }

  async function create(input: CustomFoodInput) {
    try {
      const created = await createFood.mutateAsync(
        copiedFrom === undefined ? input : withCarriedNutrients(copiedFrom, input),
      );
      continueWithSavedFood(created.food.id);
    } catch (error) {
      if (error instanceof FoodsPartialWriteError) {
        setPartiallySavedFoodId(error.foodId);
      }
      throw error;
    }
  }

  async function update(id: string, input: CustomFoodInput) {
    await updateFood.mutateAsync({ id, input });
    continueWithSavedFood(id);
  }

  async function save(input: CustomFoodInput) {
    if (hasHandedBackRef.current) {
      return;
    }
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
