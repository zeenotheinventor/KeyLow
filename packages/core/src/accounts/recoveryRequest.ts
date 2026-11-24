/** One hour, the hosted Email OTP expiration, which the copy promises ("It works once, for one hour"). */
export const RECOVERY_LINK_LIFETIME_MS = 3_600_000;

const DIGITS_ONLY = /^[1-9]\d*$/;

/**
 * The time a reset was requested, read back from where the app stored it. The web keeps it in a cookie
 * anyone can forge, so only digits that make a safe positive integer of epoch milliseconds are accepted.
 */
export function parseRecoveryRequestedAt(stored: string | null | undefined): number | null {
  if (stored === null || stored === undefined || !DIGITS_ONLY.test(stored)) {
    return null;
  }

  const requestedAt = Number(stored);

  return Number.isSafeInteger(requestedAt) ? requestedAt : null;
}

/**
 * Whether a reset was requested within the link's lifetime. The distance is absolute on purpose: a phone
 * clock moved back after the request still counts it as recent, and the window stays bounded either way.
 */
export function isRecentRecoveryRequest(requestedAt: number | null, now: number): boolean {
  return requestedAt !== null && Math.abs(now - requestedAt) < RECOVERY_LINK_LIFETIME_MS;
}
