import type { FoodFormValues } from "./types";

const DECIMAL_NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

// One comma followed by one or two digits is a decimal comma ("12,5"). Any other comma, such as a
// thousands separator in "1,000", is not read as a number.
const DECIMAL_COMMA = /^(-?\d+),(\d{1,2})$/;

/**
 * Reads a number the user typed. Blank text is absent (undefined), never 0. Text that is not a plain
 * decimal number becomes NaN so that validation rejects it.
 */
function parseNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === "") {
    return undefined;
  }
  const normalised = trimmed.replace(DECIMAL_COMMA, "$1.$2");
  return DECIMAL_NUMBER.test(normalised) ? Number(normalised) : Number.NaN;
}

const textOrUndefined = (text: string): string | undefined =>
  text.trim() === "" ? undefined : text;

function withoutUndefined(entries: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined));
}

/**
 * Turns the typed form values into the object `customFoodInputSchema` validates. Blank optional
 * fields and blank numbers are left out so the schema sees them as absent. The portion amount is
 * grams or millilitres according to the basis.
 */
export function toRawInput(values: FoodFormValues): Record<string, unknown> {
  const amountKey = values.basis === "per_100g" ? "grams" : "ml";

  return withoutUndefined({
    name: values.name,
    brand: textOrUndefined(values.brand),
    barcode: textOrUndefined(values.barcode),
    basis: values.basis,
    density_g_per_ml: values.densityGramsPerMillilitre,
    kcal: parseNumber(values.kcal),
    protein_g: parseNumber(values.protein_g),
    fat_g: parseNumber(values.fat_g),
    carbs_g: parseNumber(values.carbs_g),
    fibre_g: parseNumber(values.fibre_g),
    portions: values.portions.map((portion) =>
      withoutUndefined({
        label: portion.label,
        [amountKey]: parseNumber(portion.amount),
        isDefault: portion.isDefault,
      }),
    ),
  });
}
