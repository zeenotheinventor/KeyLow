import { offSearchRequestSchema, offSearchResponseSchema } from "@keylow/core/schemas";

import { invokeEdgeFunction } from "../edge";

import type { Database } from "../database.types";
import type { OffCandidate } from "@keylow/core/schemas";
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
