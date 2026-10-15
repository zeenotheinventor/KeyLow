import { foodToFormFields, portionToFormFields } from "@keylow/core/foods";

import type { FoodFormValues } from "./types";
import type { Food, FoodPortion } from "@keylow/core/schemas";

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

/** Fills the form from a stored food and its portions, with blank text for anything it lacks. */
export function foodToFormValues(food: Food, portions: FoodPortion[]): FoodFormValues {
  return {
    ...foodToFormFields(food),
    ...(food.density_g_per_ml === null ? {} : { densityGramsPerMillilitre: food.density_g_per_ml }),
    portions: portions.map(portionToFormFields),
  };
}
