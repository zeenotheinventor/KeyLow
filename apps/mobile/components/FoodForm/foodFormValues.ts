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

const toText = (value: number | string | null): string => (value === null ? "" : String(value));

/** Fills the form from a stored food and its portions, with blank text for anything it lacks. */
export function foodToFormValues(food: Food, portions: FoodPortion[]): FoodFormValues {
  return {
    name: food.name,
    brand: toText(food.brand),
    barcode: toText(food.barcode),
    basis: food.basis,
    kcal: toText(food.kcal),
    protein_g: toText(food.protein_g),
    fat_g: toText(food.fat_g),
    carbs_g: toText(food.carbs_g),
    fibre_g: toText(food.fibre_g),
    ...(food.density_g_per_ml === null ? {} : { densityGramsPerMillilitre: food.density_g_per_ml }),
    portions: portions.map((portion) => ({
      label: portion.label,
      amount: toText(portion.grams ?? portion.ml),
      isDefault: portion.is_default,
    })),
  };
}
