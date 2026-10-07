import {
  offProductRequestSchema,
  offProductResponseSchema,
  offSearchRequestSchema,
  offSearchResponseSchema,
} from "@keylow/core/schemas";

import { invokeEdgeFunction } from "../edge";
import { EdgeFunctionError } from "../errors";

import type { Database } from "../database.types";
import type { OffCandidate, OffProductResponse } from "@keylow/core/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";

// The longest query the contract accepts, and the cap `search_foods` applies to its own query.
const MAX_QUERY_LENGTH = 100;

/**
 * Searches Open Food Facts through the `off-search` Edge Function and returns its candidates.
 * A query longer than 100 characters is clipped to that length. The request and response follow
 * the core contract. A rate limit throws a `RateLimitedError`, and any other typed refusal an
 * `EdgeFunctionError`.
 */
export async function searchOff(
  client: SupabaseClient<Database>,
  query: string,
): Promise<OffCandidate[]> {
  const body = offSearchRequestSchema.parse({ q: query.trim().slice(0, MAX_QUERY_LENGTH) });
  const response = await invokeEdgeFunction<unknown>(client, "off-search", body);

  return offSearchResponseSchema.parse(response).candidates;
}

/**
 * Looks a barcode up through the `off-product` Edge Function, which stores a product Open Food
 * Facts knows as a shared food and returns it with its portions. Resolves to null when Open Food
 * Facts has no such product. A rate limit throws a `RateLimitedError`, and any other typed refusal
 * an `EdgeFunctionError`.
 */
export async function fetchOffProduct(
  client: SupabaseClient<Database>,
  code: string,
): Promise<OffProductResponse | null> {
  const body = offProductRequestSchema.parse({ code });

  try {
    const response = await invokeEdgeFunction<unknown>(client, "off-product", body);
    return offProductResponseSchema.parse(response);
  } catch (failure) {
    if (failure instanceof EdgeFunctionError && failure.code === "not_found") {
      return null;
    }
    throw failure;
  }
}
