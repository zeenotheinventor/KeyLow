import { z } from "zod";

import { foodPortionSchema, foodQualitySchema, foodRowSchema, nutrientBasisSchema } from "./food";
import { nutrientAmountSchema } from "./nutrients";

// The raw OFF code, shape-checked only (it mirrors the `foods.barcode` check). Callers canonicalise
// with `normaliseBarcode` before any lookup.
const barcodeDigitsSchema = z.string().regex(/^[0-9]{8,14}$/);
const nullableNutrientAmountSchema = nutrientAmountSchema.nullable();

/** Request body of the `off-search` Edge Function. */
export const offSearchRequestSchema = z.object({
  q: z.string().trim().min(2).max(100),
});

/** A normalised preview of an OFF product, shown in search results before it becomes a food row. */
export const offCandidateSchema = z.object({
  code: barcodeDigitsSchema,
  name: z.string(),
  brand: z.string().nullable(),
  basis: nutrientBasisSchema,
  kcal: nullableNutrientAmountSchema,
  protein_g: nullableNutrientAmountSchema,
  fat_g: nullableNutrientAmountSchema,
  carbs_g: nullableNutrientAmountSchema,
  fibre_g: nullableNutrientAmountSchema,
  quality: foodQualitySchema,
});

/** Response body of the `off-search` Edge Function. */
export const offSearchResponseSchema = z.object({
  candidates: z.array(offCandidateSchema),
});

/** Request body of the `off-product` Edge Function. */
export const offProductRequestSchema = z.object({
  code: barcodeDigitsSchema,
});

/** Response body of the `off-product` Edge Function: the materialised global food and its portions. */
export const offProductResponseSchema = z.object({
  food: foodRowSchema,
  portions: z.array(foodPortionSchema),
});

/**
 * The codes of the shared error body. The last three are `run-checkin`'s: a mode it does not know (400),
 * a user with no active program (409) and a user whose profile lacks a stat the engine needs (409).
 */
export const edgeErrorCodeSchema = z.enum([
  "not_found",
  "rate_limited",
  "upstream_error",
  "invalid_request",
  "unauthorized",
  "internal_error",
  "bad_mode",
  "no_program",
  "missing_stats",
]);

/** Error body shared by every Edge Function. */
export const edgeErrorSchema = z.object({
  error: z.object({
    code: edgeErrorCodeSchema,
    message: z.string(),
    retryAfterSeconds: z.number().int().positive().optional(),
  }),
});

export type OffSearchRequest = z.infer<typeof offSearchRequestSchema>;
export type OffCandidate = z.infer<typeof offCandidateSchema>;
export type OffSearchResponse = z.infer<typeof offSearchResponseSchema>;
export type OffProductRequest = z.infer<typeof offProductRequestSchema>;
export type OffProductResponse = z.infer<typeof offProductResponseSchema>;
export type EdgeErrorCode = z.infer<typeof edgeErrorCodeSchema>;
export type EdgeError = z.infer<typeof edgeErrorSchema>;
