import { OPEN_FOOD_FACTS_BUSY, describeRateLimit } from "@keylow/core/copy";

/**
 * The one sentence the boards give for a rate limit, "Open Food Facts is busy. Try again in 30
 * seconds.", built from the shared pieces so the wording never differs from the web's.
 */
export function openFoodFactsBusyTitle(retryAfterSeconds: number | undefined): string {
  return `${OPEN_FOOD_FACTS_BUSY}. ${describeRateLimit(retryAfterSeconds)}`;
}
