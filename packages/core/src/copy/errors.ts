import type { EdgeErrorCode } from "../schemas/off";

/** Says what happened and what to do, for a failure with no sentence of its own. */
export const GENERIC_ERROR = "Something went wrong. Try again.";

/** The label of a button that tries a failed load again. */
export const RETRY_LABEL = "Try again";

/**
 * How long to wait before retrying, for a rate limited call: "Try again in 30 seconds." The time
 * rounds up so a retry is never early. With no time known, or under a second, it reads "a moment".
 */
export const describeRateLimit = (retryAfterSeconds: number | undefined): string => {
  if (
    retryAfterSeconds === undefined ||
    !(retryAfterSeconds >= 1) ||
    !Number.isFinite(retryAfterSeconds)
  ) {
    return "Try again in a moment.";
  }
  const seconds = Math.ceil(retryAfterSeconds);
  return `Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`;
};

const EDGE_ERROR_SENTENCES: Readonly<Record<EdgeErrorCode, string>> = {
  not_found:
    "Open Food Facts no longer has this product. Search again, or create the food yourself.",
  rate_limited: `Open Food Facts is busy. ${describeRateLimit(undefined)}`,
  upstream_error: "Open Food Facts did not answer. Try again in a moment.",
  invalid_request: "That request was not valid. Check what you entered and try again.",
  unauthorized: "Your session has ended. Sign in again.",
  internal_error: "Ki-Lo had a problem with that request. Try again in a moment.",
};

/**
 * One fixed sentence for each Edge Function error code, never the raw code or the server's
 * message. An unknown failure, or none, gets the generic sentence.
 */
export const describeEdgeError = (kind: EdgeErrorCode | undefined): string =>
  kind === undefined ? GENERIC_ERROR : EDGE_ERROR_SENTENCES[kind];
