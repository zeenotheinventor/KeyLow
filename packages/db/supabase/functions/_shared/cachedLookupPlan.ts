// What off-product does with a food it already holds, decided from its fetch time alone so it can be
// tested without a server.
import { isBeforePortionRules, offFreshness } from "./core.ts";

export type CachedLookupPlan =
  // Stored under older portion rules: fetch and store it now, so the answer carries the new portions.
  | "refresh_before_answering"
  // Older than 90 days: answer from the cache, refresh after the response.
  | "answer_then_refresh"
  | "answer";

export function planCachedLookup(fetchedAt: string, now: Date): CachedLookupPlan {
  if (isBeforePortionRules(fetchedAt)) {
    return "refresh_before_answering";
  }
  return offFreshness(fetchedAt, now) === "stale" ? "answer_then_refresh" : "answer";
}
