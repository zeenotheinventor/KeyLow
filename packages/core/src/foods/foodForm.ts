import type { Food, FoodPortion, NutrientBasis } from "../schemas/food";

const PLAIN_DECIMAL = /^-?(\d+\.?\d*|\.\d+)$/;

// One comma followed by one or two digits is a decimal comma ("12,5"). Any other comma, such as a
// thousands separator in "1,000", is not read as a number.
const DECIMAL_COMMA = /^(-?\d+),(\d{1,2})$/;

/**
 * Reads a number the user typed into a food form. Blank text is absent (undefined), never 0. A plain
 * decimal number is read as it is, and so is one with a decimal comma. Anything else, such as "1e3",
 * "0x1A" or "Infinity", is NaN so that the schema reports it as not a number.
 */
export function parseFormNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === "") {
    return undefined;
  }
  const normalised = trimmed.replace(DECIMAL_COMMA, "$1.$2");
  return PLAIN_DECIMAL.test(normalised) ? Number(normalised) : Number.NaN;
}

/** The unit every portion amount is in: grams under a per 100 g basis, millilitres under per 100 ml. */
export const amountUnit = (basis: NutrientBasis): "g" | "ml" => (basis === "per_100g" ? "g" : "ml");

/** The key a portion's amount has in the custom food input. */
export const portionAmountKey = (basis: NutrientBasis): "grams" | "ml" =>
  basis === "per_100g" ? "grams" : "ml";

/** The nutrients the schema requires, in the order the forms draw them. Fibre may be left blank. */
export const REQUIRED_FOOD_NUTRIENTS = ["kcal", "protein_g", "carbs_g", "fat_g"] as const;

export type RequiredFoodNutrient = (typeof REQUIRED_FOOD_NUTRIENTS)[number];

/** One portion as a form holds it. The amount is text until the form is validated. */
export type PortionFormFields = { label: string; amount: string; isDefault: boolean };

/** The fields of a food form, keyed as `customFoodInputSchema` is. Every number is text until validated. */
export type FoodFormFields = {
  name: string;
  brand: string;
  barcode: string;
  basis: NutrientBasis;
  kcal: string;
  protein_g: string;
  fat_g: string;
  carbs_g: string;
  fibre_g: string;
};

export type FoodFormFieldsWithPortions = FoodFormFields & {
  portions: readonly PortionFormFields[];
};

const textOrUndefined = (text: string): string | undefined =>
  text.trim() === "" ? undefined : text.trim();

function withoutUndefined(entries: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined));
}

/**
 * Turns the typed form values into the raw input `customFoodInputSchema` validates. Blank optional
 * fields and blank numbers are left out, so the schema sees them as absent and a blank required
 * number reads as missing rather than as zero. The density is not a form field, so the food's own
 * value is passed in to keep an edit from clearing it.
 */
export function customFoodInputFrom(
  values: FoodFormFieldsWithPortions,
  density: number | null,
): Record<string, unknown> {
  const amountKey = portionAmountKey(values.basis);

  return withoutUndefined({
    name: values.name,
    brand: textOrUndefined(values.brand),
    barcode: textOrUndefined(values.barcode),
    basis: values.basis,
    density_g_per_ml: density ?? undefined,
    kcal: parseFormNumber(values.kcal),
    protein_g: parseFormNumber(values.protein_g),
    fat_g: parseFormNumber(values.fat_g),
    carbs_g: parseFormNumber(values.carbs_g),
    fibre_g: parseFormNumber(values.fibre_g),
    portions: values.portions.map((portion) =>
      withoutUndefined({
        label: portion.label,
        [amountKey]: parseFormNumber(portion.amount),
        isDefault: portion.isDefault,
      }),
    ),
  });
}

const numberToText = (value: number | null): string => (value === null ? "" : String(value));

/** Fills the form from a stored food, with blank text for anything it lacks. */
export function foodToFormFields(food: Food): FoodFormFields {
  return {
    name: food.name,
    brand: food.brand ?? "",
    barcode: food.barcode ?? "",
    basis: food.basis,
    kcal: numberToText(food.kcal),
    protein_g: numberToText(food.protein_g),
    fat_g: numberToText(food.fat_g),
    carbs_g: numberToText(food.carbs_g),
    fibre_g: numberToText(food.fibre_g),
  };
}

/** Fills one portion row of the form from a stored portion, whose amount is grams or millilitres. */
export function portionToFormFields(portion: FoodPortion): PortionFormFields {
  return {
    label: portion.label,
    amount: numberToText(portion.grams ?? portion.ml),
    isDefault: portion.is_default,
  };
}

export type CopyFormStart = {
  fields: FoodFormFields;
  /** The required nutrients that start blank, because the source food did not give them. */
  notGiven: readonly RequiredFoodNutrient[];
  /** True when the carbohydrate was left blank because the source's included fibre. */
  isCarbsIncludingFibre: boolean;
};

/**
 * What the form starts with when it copies a food. A US total carbohydrate includes fibre and is
 * never converted here, so it is left blank for the user to enter without fibre.
 */
export function copyFormStart(food: Food): CopyFormStart {
  const isCarbsIncludingFibre = food.quality.carbs_convention === "us_total";
  const copied = foodToFormFields(food);
  const fields = isCarbsIncludingFibre ? { ...copied, carbs_g: "" } : copied;

  return {
    fields,
    notGiven: REQUIRED_FOOD_NUTRIENTS.filter((nutrient) => fields[nutrient] === ""),
    isCarbsIncludingFibre,
  };
}
