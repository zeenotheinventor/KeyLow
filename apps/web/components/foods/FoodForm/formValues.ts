import { copyFormStart, foodToFormFields, portionToFormFields } from "@keylow/core/foods";

import type { FoodFormExistingFood, FoodFormValues, PortionFormValues } from "./types";
import type { RequiredFoodNutrient } from "@keylow/core/foods";

export const emptyFoodFormValues: FoodFormValues = {
  name: "",
  brand: "",
  barcode: "",
  basis: "per_100g",
  kcal: "",
  protein_g: "",
  fat_g: "",
  carbs_g: "",
  fibre_g: "",
  portions: [],
};

function savedPortions({ portions }: FoodFormExistingFood): PortionFormValues[] {
  return portions.map((portion, index) => ({
    key: `saved-${String(index)}`,
    ...portionToFormFields(portion),
  }));
}

export function foodFormValuesFrom(
  existing: FoodFormExistingFood | undefined,
  scannedBarcode: string | undefined,
): FoodFormValues {
  if (existing === undefined) {
    return { ...emptyFoodFormValues, barcode: scannedBarcode ?? "" };
  }

  return { ...foodToFormFields(existing.food), portions: savedPortions(existing) };
}

export type FormStart = {
  values: FoodFormValues;
  /** The required nutrients that started blank on a copy, because the source did not give them. */
  notGiven: readonly RequiredFoodNutrient[];
  /** Whether the carbohydrate of a copied food was left blank because it included fibre. */
  isCarbsIncludingFibre: boolean;
};

/** What the form starts with: a new food, the food being edited, or a copy of a food. */
export function formStartFrom(
  existing: FoodFormExistingFood | undefined,
  copyOf: FoodFormExistingFood | undefined,
  scannedBarcode: string | undefined,
): FormStart {
  if (existing !== undefined || copyOf === undefined) {
    return {
      values: foodFormValuesFrom(existing, scannedBarcode),
      notGiven: [],
      isCarbsIncludingFibre: false,
    };
  }

  const { fields, notGiven, isCarbsIncludingFibre } = copyFormStart(copyOf.food);
  return {
    values: { ...fields, portions: savedPortions(copyOf) },
    notGiven,
    isCarbsIncludingFibre,
  };
}
