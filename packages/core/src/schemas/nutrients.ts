import { z } from "zod";

export const nutrientAmountSchema = z.number().nonnegative();

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
