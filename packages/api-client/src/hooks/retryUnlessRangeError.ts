const MAXIMUM_RETRIES = 3;

/**
 * The retry rule of the diary reads that validate their key. A `RangeError` means the date or month
 * was not valid, which asking again cannot change, so it fails at once. Anything else (a lost
 * connection, a server error) is retried up to three times, as TanStack Query does by default.
 */
export const retryUnlessRangeError = (failureCount: number, error: unknown): boolean =>
  !(error instanceof RangeError) && failureCount < MAXIMUM_RETRIES;
