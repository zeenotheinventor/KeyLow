import { z } from "zod";

import { normaliseBarcode } from "./barcode";
import { deriveOffPortions } from "./deriveOffPortions";
import {
  buildQuality,
  collectMicros,
  inferBasis,
  isUsLabelled,
  listMissingMacros,
  pickBrand,
  pickFoodGroup,
  pickName,
  resolveCarbs,
  resolveEnergy,
  resolvePer100Amounts,
  resolveSalt,
  toNonNegativeNumber,
} from "./offRules";

import type { OffPortionInput } from "./offRules";
import type { Food } from "../schemas/food";
import type { OffCandidate } from "../schemas/off";

// A field of the wrong type reads as missing (never an error), so one odd value in a third-party
// payload cannot hide the rest of the product. Nothing is defaulted, a missing value stays undefined.
function lenient<Schema extends z.ZodType>(schema: Schema) {
  return schema.optional().catch(undefined);
}

const numberOrStringSchema = z.union([z.number(), z.string()]);
const stringArraySchema = z.array(z.string());

/**
 * The OFF `product` object, as returned by `/api/v2/product/{code}.json` and by
 * `/cgi/search.pl?json=1`. Every field is optional and unknown keys pass through.
 * `serving_quantity` is read to a number (OFF sends numbers and numeric strings), and the values
 * in `nutriments` stay as sent (numbers, numeric strings and `_unit` strings) until they are read.
 */
export const offProductPayloadSchema = z.looseObject({
  code: lenient(z.string()),
  product_name: lenient(z.string()),
  product_name_en: lenient(z.string()),
  brands: lenient(z.string()),
  quantity: lenient(z.string()),
  serving_size: lenient(z.string()),
  serving_quantity: lenient(numberOrStringSchema.transform(toNonNegativeNumber)),
  nutrition_data_per: lenient(z.string()),
  countries_tags: lenient(stringArraySchema),
  categories_tags: lenient(stringArraySchema),
  packaging_tags: lenient(stringArraySchema),
  nutriments: lenient(z.record(z.string(), lenient(numberOrStringSchema))),
});

export type OffProductPayload = z.infer<typeof offProductPayloadSchema>;

/** The `foods` columns the service role inserts for an OFF row (the writer adds id, source, source_ref, owner_id and fetched_at). */
export type OffFoodInput = Omit<
  Food,
  | "id"
  | "source"
  | "source_ref"
  | "owner_id"
  | "fetched_at"
  | "deleted_at"
  | "created_at"
  | "barcode"
  | "micros"
> & {
  barcode: string;
  micros: Record<string, number>;
};

export type { OffPortionInput };

export type NormaliseOffResult =
  | { ok: true; food: OffFoodInput; portions: OffPortionInput[] }
  | { ok: false; reason: "invalid_payload" | "no_code" | "no_name" };

/**
 * Turns an OFF product payload into the `foods` row and portions we store, without inventing a value:
 * anything the payload does not record stays null, and a product missing a macro is flagged suspect.
 * The rules live in `offRules.ts`, this function only composes them.
 */
export function normaliseOffProduct(raw: unknown): NormaliseOffResult {
  const parsed = offProductPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "invalid_payload" };
  }
  const product = parsed.data;

  const barcode = normaliseBarcode(product.code ?? "");
  if (!barcode.ok) {
    return { ok: false, reason: "no_code" };
  }
  const name = pickName({
    productNameEnglish: product.product_name_en,
    productName: product.product_name,
  });
  if (name === undefined) {
    return { ok: false, reason: "no_name" };
  }

  const { amounts, perServingConverted } = resolvePer100Amounts(product.nutriments ?? {}, {
    nutritionDataPer: product.nutrition_data_per,
    servingQuantity: product.serving_quantity,
  });
  const protein = amounts.proteins ?? null;
  const fat = amounts.fat ?? null;
  const fibre = amounts.fiber ?? null;
  const { carbs, convention } = resolveCarbs({
    carbs: amounts.carbohydrates ?? null,
    fibre,
    usLabelled: isUsLabelled(product.countries_tags),
  });
  const { kcal, kcalDerived } = resolveEnergy(amounts, { protein, fat, carbs, fibre });
  const basis = inferBasis({ quantity: product.quantity, servingSize: product.serving_size });

  const missingMacros = listMissingMacros({
    kcal,
    protein_g: protein,
    fat_g: fat,
    carbs_g: carbs,
  });
  const portions = deriveOffPortions({
    servingSize: product.serving_size,
    servingQuantity: product.serving_quantity,
    quantity: product.quantity,
    basis,
    packagingTags: product.packaging_tags,
    categoriesTags: product.categories_tags,
    kcal,
  });

  return {
    ok: true,
    food: {
      barcode: barcode.code,
      name,
      brand: pickBrand(product.brands),
      basis,
      density_g_per_ml: null,
      kcal,
      protein_g: protein,
      fat_g: fat,
      sat_fat_g: amounts["saturated-fat"] ?? null,
      carbs_g: carbs,
      sugars_g: amounts.sugars ?? null,
      fibre_g: fibre,
      salt_g: resolveSalt(amounts),
      micros: collectMicros(amounts),
      quality: buildQuality({
        kcalDerived,
        perServingConverted,
        missingMacros,
        carbsConvention: convention,
      }),
      food_group: pickFoodGroup(product.categories_tags),
    },
    portions,
  };
}

/** The `off-search` preview of a product, or null when it cannot become a food (see `normaliseOffProduct`). */
export function normaliseOffCandidate(raw: unknown): OffCandidate | null {
  const result = normaliseOffProduct(raw);
  if (!result.ok) {
    return null;
  }
  const { food } = result;
  return {
    code: food.barcode,
    name: food.name,
    brand: food.brand,
    basis: food.basis,
    kcal: food.kcal,
    protein_g: food.protein_g,
    fat_g: food.fat_g,
    carbs_g: food.carbs_g,
    fibre_g: food.fibre_g,
    quality: food.quality,
  };
}
