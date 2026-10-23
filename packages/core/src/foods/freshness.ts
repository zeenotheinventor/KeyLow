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

/**
 * When the current portion rules (the pack portion of KEY-518 and the borrowed natural units of KEY-520)
 * went live in production: the Deploy Supabase run for KEY-520 completed at this instant. Products
 * stored from Open Food Facts before it lack those portions.
 *
 * Bump this date whenever the portion rules change and stored products should be re-derived. Set it to
 * the moment the new rules are live in production, never earlier, or a lookup in between would store
 * the old rules' portions and not be refreshed again.
 */
export const OFF_PORTION_RULES_FROM = "2026-10-23T02:16:15Z";

/**
 * True when a food was fetched before `OFF_PORTION_RULES_FROM`, so its portions were derived under older
 * rules and the food should be fetched again. A timestamp that cannot be parsed also reads true, as in
 * `offFreshness`, which refetches the food. Core never reads the clock, and this needs none.
 */
export function isBeforePortionRules(fetchedAt: string | Date): boolean {
  return !(new Date(fetchedAt).getTime() >= new Date(OFF_PORTION_RULES_FROM).getTime());
}
