/** Tells the user Open Food Facts is rate limited and, when known, how long to wait. */
export function describeRateLimit(retryAfterSeconds: number | undefined): string {
  if (retryAfterSeconds === undefined) {
    return "Open Food Facts is busy. Try again in a moment.";
  }
  const unit = retryAfterSeconds === 1 ? "second" : "seconds";
  return `Open Food Facts is busy. Try again in ${retryAfterSeconds} ${unit}.`;
}
