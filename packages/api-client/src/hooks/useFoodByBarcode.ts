import { normaliseBarcode } from "@keylow/core/foods";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";

import { toOffError } from "./useFoodSearch";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getFoodByBarcode } from "../repos/foods";
import { fetchOffProduct } from "../repos/off";
import { seedOffProduct } from "../seedOffProduct";

import type { FoodSearchOffError } from "./useFoodSearch";
import type { Database } from "../database.types";
import type { BarcodeInvalidReason, BarcodeSymbology } from "@keylow/core/foods";
import type { Food } from "@keylow/core/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

// A barcode lookup is cached this long, so scanning the same product again asks nobody.
const STALE_TIME_MS = 5 * 60 * 1000;

/** What the lookup of a valid barcode found. */
export type FoodByBarcodeLookup =
  { status: "found"; food: Food } | { status: "not_found"; code: string };

/** The outcome of a barcode lookup, including a code that is not a barcode at all. */
export type FoodByBarcodeResult =
  FoodByBarcodeLookup | { status: "invalid"; reason: BarcodeInvalidReason };

/** Why the lookup failed, in the same shape as the Open Food Facts error of `useFoodSearch`. */
export type FoodByBarcodeError = FoodSearchOffError;

export type UseFoodByBarcodeOptions = {
  /** Set to false to make no request at all. Defaults to true. */
  enabled?: boolean;
  /**
   * What the camera reported the code as. It only matters at 8 digits, where it decides between
   * EAN-8 and UPC-E (see `normaliseBarcode`). Leave it out for a typed code.
   */
  symbology?: BarcodeSymbology;
};

export type UseFoodByBarcodeReturn = {
  /**
   * Undefined until the lookup settles, or when it is disabled or has only failed. A failed later
   * lookup of the same code keeps the previous result here and reports the failure in `error`.
   */
  result: FoodByBarcodeResult | undefined;
  isLoading: boolean;
  error: FoodByBarcodeError | null;
};

async function lookUpFoodByBarcode(
  client: SupabaseClient<Database>,
  queryClient: QueryClient,
  code: string,
): Promise<FoodByBarcodeLookup> {
  const localFood = await getFoodByBarcode(client, code);

  if (localFood !== null) {
    queryClient.setQueryData(keys.foods.detail(localFood.id), localFood);
    return { status: "found", food: localFood };
  }

  const product = await fetchOffProduct(client, code);

  if (product === null) {
    return { status: "not_found", code };
  }

  seedOffProduct(queryClient, product);
  return { status: "found", food: product.food };
}

/**
 * Finds the food for a scanned or typed barcode. The code is normalised first, and one that is not
 * a valid barcode resolves to `invalid` with no request at all. A valid one is looked up in the
 * local foods (the user's own first) and only when that finds nothing is Open Food Facts asked,
 * through `off-product`, which stores the product. Open Food Facts not knowing it resolves to
 * `not_found`. A food found is also seeded into its detail cache. A failed lookup is not retried
 * and not repeated when the window regains focus, since a rate limit will not pass by trying again.
 */
export function useFoodByBarcode(
  rawCode: string,
  options: UseFoodByBarcodeOptions = {},
): UseFoodByBarcodeReturn {
  const { enabled = true, symbology } = options;
  const client = useSupabase();
  const queryClient = useQueryClient();
  const normalised = normaliseBarcode(rawCode, symbology);
  const code = normalised.ok ? normalised.code : undefined;

  const lookup = useQuery({
    queryKey: keys.foods.barcode(code ?? ""),
    queryFn:
      enabled && code !== undefined
        ? () => lookUpFoodByBarcode(client, queryClient, code)
        : skipToken,
    staleTime: STALE_TIME_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (!normalised.ok) {
    return {
      result: { status: "invalid", reason: normalised.reason },
      isLoading: false,
      error: null,
    };
  }

  return { result: lookup.data, isLoading: lookup.isLoading, error: toOffError(lookup.error) };
}
