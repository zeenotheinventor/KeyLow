import { z } from "zod";

import { nutrientAmountSchema } from "./nutrients";
import { FOOD_FORM } from "../copy/foodForm";
import { normaliseBarcode } from "../foods/barcode";

export const foodSourceSchema = z.enum(["off", "cofid", "user"]);
export const nutrientBasisSchema = z.enum(["per_100g", "per_100ml"]);

/**
 * The `foods.quality` key set (ADR 0003, Amendment 1). Every key is optional: an absent
 * boolean reads as false and an absent array reads as empty, so `{}` is the neutral value.
 * `carbs_convention` describes the stored `carbs_g`, `us_total` only when it could not be converted.
 * For OFF rows an explicit `eu` means the value was converted from a US-style label, absent means no
 * conversion happened, and `us_total` means the label was US-style and could not be converted.
 */
export const foodQualitySchema = z.object({
  kcal_derived: z.boolean().optional(),
  suspect: z.boolean().optional(),
  fields_missing: z.array(z.string()).optional(),
  fibre_method: z.enum(["aoac", "englyst"]).optional(),
  trace_fields: z.array(z.string()).optional(),
  per_serving_converted: z.boolean().optional(),
  carbs_convention: z.enum(["eu", "us_total"]).optional(),
});

// z.guid() rather than z.uuid(): seed files use fixed literal ids that are not RFC 4122 variants.
const rowIdSchema = z.guid();
const timestampSchema = z.iso.datetime({ offset: true });
const nullableNutrientAmountSchema = nutrientAmountSchema.nullable();

/** A `foods` row as returned by PostgREST. `search` is a generated DB-only column and is omitted. */
export const foodRowSchema = z.object({
  id: rowIdSchema,
  source: foodSourceSchema,
  source_ref: z.string().nullable(),
  owner_id: rowIdSchema.nullable(),
  name: z.string(),
  brand: z.string().nullable(),
  barcode: z.string().nullable(),
  basis: nutrientBasisSchema,
  density_g_per_ml: z.number().positive().nullable(),
  kcal: nullableNutrientAmountSchema,
  protein_g: nullableNutrientAmountSchema,
  fat_g: nullableNutrientAmountSchema,
  sat_fat_g: nullableNutrientAmountSchema,
  carbs_g: nullableNutrientAmountSchema,
  sugars_g: nullableNutrientAmountSchema,
  fibre_g: nullableNutrientAmountSchema,
  salt_g: nullableNutrientAmountSchema,
  micros: z.record(z.string(), z.json()),
  quality: foodQualitySchema,
  food_group: z.string().nullable(),
  fetched_at: timestampSchema.nullable(),
  deleted_at: timestampSchema.nullable(),
  created_at: timestampSchema,
});

/** A `food_portions` row: exactly one of `grams` and `ml` is set, and it is positive. */
export const foodPortionSchema = z
  .object({
    id: rowIdSchema,
    food_id: rowIdSchema,
    owner_id: rowIdSchema.nullable(),
    label: z.string(),
    grams: z.number().positive().nullable(),
    ml: z.number().positive().nullable(),
    is_default: z.boolean(),
    position: z.number().int(),
    created_at: timestampSchema,
  })
  .refine((portion) => (portion.grams === null) !== (portion.ml === null), {
    message: "Exactly one of grams and ml must be set",
  });

const customFoodPortionInputSchema = z
  .object({
    label: z.string().trim().min(1),
    grams: z.number().positive().optional(),
    ml: z.number().positive().optional(),
    isDefault: z.boolean(),
  })
  .refine((portion) => (portion.grams === undefined) !== (portion.ml === undefined), {
    message: "Exactly one of grams and ml must be set",
  });

/** The barcode in canonical form, or an issue on its path when it is not a valid GTIN. */
const canonicalBarcodeSchema = z.string().transform((raw, context) => {
  const result = normaliseBarcode(raw);
  if (result.ok) {
    return result.code;
  }
  context.issues.push({
    code: "custom",
    message: `Invalid barcode: ${result.reason}`,
    input: raw,
  });
  return z.NEVER;
});

export const customFoodInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  // A blank brand normalises to undefined so it is never stored as "" where null belongs.
  brand: z
    .string()
    .trim()
    .transform((brand) => (brand === "" ? undefined : brand))
    .optional(),
  barcode: canonicalBarcodeSchema.optional(),
  basis: nutrientBasisSchema,
  density_g_per_ml: z.number().positive().optional(),
  kcal: nutrientAmountSchema,
  protein_g: nutrientAmountSchema,
  fat_g: nutrientAmountSchema,
  carbs_g: nutrientAmountSchema,
  fibre_g: nutrientAmountSchema.optional(),
  portions: z
    .array(customFoodPortionInputSchema)
    .refine((portions) => portions.filter((portion) => portion.isDefault).length <= 1, {
      message: FOOD_FORM.onlyOneDefaultPortion,
    }),
});

export type FoodSource = z.infer<typeof foodSourceSchema>;
export type NutrientBasis = z.infer<typeof nutrientBasisSchema>;
export type FoodQuality = z.infer<typeof foodQualitySchema>;
export type Food = z.infer<typeof foodRowSchema>;
export type FoodPortion = z.infer<typeof foodPortionSchema>;
export type CustomFoodInput = z.infer<typeof customFoodInputSchema>;
