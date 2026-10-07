import { foodRow, portionRow } from "./postgrest";

import type { Food, FoodPortion, OffProductResponse } from "@keylow/core/schemas";

export const OFF_PRODUCT_URL = "http://127.0.0.1:54321/functions/v1/off-product";

/** A valid EAN-13, so `normaliseBarcode` keeps it as it is. */
export const VALID_BARCODE = "4006381333931";

/** The same digits with the check digit changed, so `normaliseBarcode` refuses it. */
export const BAD_CHECK_DIGIT_BARCODE = "4006381333932";

export const GLOBAL_FOOD_ID = "44444444-4444-4444-8444-444444444444";

/** A shared Open Food Facts row, the kind `off-product` stores (no owner). */
export const globalFoodRow = (overrides: Partial<Food> = {}): Food =>
  foodRow({
    id: GLOBAL_FOOD_ID,
    source: "off",
    source_ref: VALID_BARCODE,
    owner_id: null,
    name: "Chocolate hazelnut spread",
    barcode: VALID_BARCODE,
    fetched_at: "2026-10-07T10:00:00.123456+00:00",
    ...overrides,
  });

/** A global portion belonging to `globalFoodRow`. */
export const globalPortionRow = (overrides: Partial<FoodPortion> = {}): FoodPortion =>
  portionRow({
    id: "55555555-5555-4555-8555-555555555555",
    food_id: GLOBAL_FOOD_ID,
    owner_id: null,
    label: "1 tbsp",
    grams: 15,
    ...overrides,
  });

/** The body `off-product` answers 200 with. */
export const offProductResponse = (
  overrides: Partial<OffProductResponse> = {},
): OffProductResponse => ({
  food: globalFoodRow(),
  portions: [globalPortionRow()],
  ...overrides,
});
