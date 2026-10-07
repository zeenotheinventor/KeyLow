/** An OFF food older than this is refetched (the 90 day freshness rule). */
export const OFF_FRESHNESS_MS = 90 * 24 * 60 * 60 * 1000;

/** How far ahead of `now` a fetch time may be and still count as clock skew. */
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

export type OffFreshness = "fresh" | "stale";

/**
 * A food is `fresh` while it is younger than 90 days, so exactly 90 days old is already `stale`.
 * A fetch time up to 24 hours ahead of `now` is clock skew and stays fresh, but anything further ahead
 * is a corrupt value and reads `stale`, so it is not fresh forever. A timestamp that cannot be parsed
 * compares false and so also reads `stale`, which refetches the food.
 * The caller passes `now`, because core never reads the clock.
 */
export function offFreshness(fetchedAt: string | Date, now: Date): OffFreshness {
  const ageMilliseconds = now.getTime() - new Date(fetchedAt).getTime();
  const isFresh = ageMilliseconds >= -MAX_CLOCK_SKEW_MS && ageMilliseconds < OFF_FRESHNESS_MS;
  return isFresh ? "fresh" : "stale";
}
