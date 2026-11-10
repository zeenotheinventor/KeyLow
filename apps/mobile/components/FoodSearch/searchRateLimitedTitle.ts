import { SEARCH_RATE_LIMITED, describeRateLimit } from "@keylow/core/copy";

/**
 * The one sentence the boards give for a rate limit, "Too many searches just now. Try again in 30
 * seconds.", built from the shared pieces so the wording never differs from the web's.
 */
export function searchRateLimitedTitle(retryAfterSeconds: number | undefined): string {
  return `${SEARCH_RATE_LIMITED}. ${describeRateLimit(retryAfterSeconds)}`;
}
