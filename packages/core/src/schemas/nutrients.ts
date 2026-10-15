import { z } from "zod";

export const nutrientAmountSchema = z.number().nonnegative();

/**
 * The most a food can plausibly hold per 100 g or 100 ml: 900 kcal is pure fat, and nothing weighs
 * more than itself. These bound what a person types into a food (see `customFoodInputSchema`), to
 * catch typos. They do not bound a stored food, a diary entry or a day total: a day's energy is far
 * over 900, and the sources record what they record (CoFID sugars are above 100 g per 100 g).
 */
export const MAX_KCAL_PER_100 = 900;
export const MAX_GRAMS_PER_100 = 100;

/** Energy typed in for a food, per 100 g or 100 ml. */
export const kcalPer100InputSchema = nutrientAmountSchema.max(MAX_KCAL_PER_100);

/** A nutrient in grams typed in for a food, per 100 g or 100 ml. */
export const gramsPer100InputSchema = nutrientAmountSchema.max(MAX_GRAMS_PER_100);

const nullableNutrientAmountSchema = nutrientAmountSchema.nullable();

// `nutrientsSchema` is the nullable shape that rows and previews carry, `strictNutrientsSchema` is the
// non-null shape the maths operates on once the five core values are known.
/**
 * Nutrients as stored on a food row: the five core values are always present as keys but
 * null when the source did not record them (missing data is null, never 0).
 */
export const nutrientsSchema = z.object({
  kcal: nullableNutrientAmountSchema,
  protein_g: nullableNutrientAmountSchema,
  fat_g: nullableNutrientAmountSchema,
  carbs_g: nullableNutrientAmountSchema,
  fibre_g: nullableNutrientAmountSchema,
  sat_fat_g: nullableNutrientAmountSchema.optional(),
  sugars_g: nullableNutrientAmountSchema.optional(),
  salt_g: nullableNutrientAmountSchema.optional(),
});

/** Nutrients with the five core values known, which is what the maths operates on. */
export const strictNutrientsSchema = nutrientsSchema.extend({
  kcal: nutrientAmountSchema,
  protein_g: nutrientAmountSchema,
  fat_g: nutrientAmountSchema,
  carbs_g: nutrientAmountSchema,
  fibre_g: nutrientAmountSchema,
});

export type NullableNutrients = z.infer<typeof nutrientsSchema>;
export type Nutrients = z.infer<typeof strictNutrientsSchema>;
