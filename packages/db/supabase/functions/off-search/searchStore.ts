// The two database calls the off-search function makes on `off_search_results` (ADR 0003,
// Amendment 16). Both use the service client, because the table is closed to every API role. Both
// throw on a database error and quote nothing from it, because the database's message can carry the
// key, which is the person's search words. The caller reports the failure and carries on.
import { OFF_SEARCH_KEEP_SECONDS } from "../_shared/core.ts";
import { createServiceClient } from "../_shared/clients.ts";

import type { OffCandidate } from "../_shared/core.ts";

export type StoredSearchRow = { candidates: unknown; fetched_at: string };

export async function readSearchRow(queryKey: string): Promise<StoredSearchRow | null> {
  const { data, error } = await createServiceClient()
    .from("off_search_results")
    .select("candidates, fetched_at")
    .eq("query_key", queryKey)
    .maybeSingle();
  if (error !== null) {
    throw new Error(`reading off_search_results failed with code ${error.code}`);
  }
  return data;
}

export async function storeSearchRow(queryKey: string, candidates: OffCandidate[]): Promise<void> {
  const { error } = await createServiceClient().rpc("store_off_search_results", {
    p_query_key: queryKey,
    p_candidates: candidates,
    p_keep_seconds: OFF_SEARCH_KEEP_SECONDS,
  });
  if (error !== null) {
    throw new Error(`store_off_search_results failed with code ${error.code}`);
  }
}
