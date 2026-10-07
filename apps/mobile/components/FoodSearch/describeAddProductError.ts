import { OffProductNotFoundError, RateLimitedError } from "@keylow/api-client";

import { describeRateLimit } from "./describeRateLimit";

/** Why adding an Open Food Facts product to the user's foods failed, in words for the user. */
export function describeAddProductError(error: unknown): string {
  if (error instanceof RateLimitedError) {
    return describeRateLimit(error.retryAfterSeconds);
  }
  if (error instanceof OffProductNotFoundError) {
    return "Open Food Facts no longer has this product.";
  }
  return "This product could not be added. Check your connection and try again.";
}
