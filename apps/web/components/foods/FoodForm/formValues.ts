import type { FoodFormExistingFood, FoodFormValues, PortionFormValues } from "./types";
import type { NutrientBasis } from "@keylow/core/schemas";

const numberToText = (value: number | null) => (value === null ? "" : String(value));

export const emptyFoodFormValues: FoodFormValues = {
  name: "",
  brand: "",
  barcode: "",
  basis: "per_100g",
  kcal: "",
  protein: "",
  fat: "",
  carbs: "",
  fibre: "",
  portions: [],
};

export function foodFormValuesFrom(
  existing: FoodFormExistingFood | undefined,
  scannedBarcode: string | undefined,
): FoodFormValues {
  if (existing === undefined) {
    return { ...emptyFoodFormValues, barcode: scannedBarcode ?? "" };
  }

  const { food, portions } = existing;

  return {
    name: food.name,
    brand: food.brand ?? "",
    barcode: food.barcode ?? "",
    basis: food.basis,
    kcal: numberToText(food.kcal),
    protein: numberToText(food.protein_g),
    fat: numberToText(food.fat_g),
    carbs: numberToText(food.carbs_g),
    fibre: numberToText(food.fibre_g),
    portions: portions.map((portion, index) => ({
      key: `saved-${String(index)}`,
      label: portion.label,
      amount: numberToText(portion.grams ?? portion.ml),
      isDefault: portion.is_default,
    })),
  };
}

export const amountUnit = (basis: NutrientBasis) => (basis === "per_100g" ? "g" : "ml");

const optionalText = (text: string) => (text.trim() === "" ? undefined : text.trim());
const optionalNumber = (text: string) => (text.trim() === "" ? undefined : Number(text));

function withoutUndefined(fields: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function portionInput(portion: PortionFormValues, basis: NutrientBasis) {
  return withoutUndefined({
    label: portion.label,
    [basis === "per_100g" ? "grams" : "ml"]: optionalNumber(portion.amount),
    isDefault: portion.isDefault,
  });
}

/**
 * The shape `customFoodInputSchema` validates. Blank optional fields are left out, and a blank
 * required number is left out too so that it reads as missing rather than as zero. The density
 * is not on the form, so an existing food's value is passed through to avoid clearing it.
 */
export function foodInputFrom(values: FoodFormValues, density: number | null) {
  return withoutUndefined({
    name: values.name,
    brand: optionalText(values.brand),
    barcode: optionalText(values.barcode),
    basis: values.basis,
    density_g_per_ml: density ?? undefined,
    kcal: optionalNumber(values.kcal),
    protein_g: optionalNumber(values.protein),
    fat_g: optionalNumber(values.fat),
    carbs_g: optionalNumber(values.carbs),
    fibre_g: optionalNumber(values.fibre),
    portions: values.portions.map((portion) => portionInput(portion, values.basis)),
  });
}
