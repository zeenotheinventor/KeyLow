import { parseRecoveryRequestedAt } from "@keylow/core/accounts";

/**
 * Records when a password reset was requested on this browser. The forgot password page sets it, and the
 * callback route reads it to tell a failed reset link from a failed sign in link, then clears it once a
 * reset link works. It holds a time and nothing else.
 */
export const RECOVERY_REQUESTED_COOKIE = "kl-recovery-requested";

const ONE_HOUR_IN_SECONDS = 3600;

/** The `document.cookie` string that records a reset request made at `now`, in epoch milliseconds. */
export function describeRecoveryRequestedCookie(now: number, isSecure: boolean): string {
  const attributes = `path=/; max-age=${String(ONE_HOUR_IN_SECONDS)}; SameSite=Lax`;

  return `${RECOVERY_REQUESTED_COOKIE}=${String(now)}; ${attributes}${isSecure ? "; Secure" : ""}`;
}

/** The `document.cookie` string that removes the record. */
export function describeClearedRecoveryRequestedCookie(): string {
  return `${RECOVERY_REQUESTED_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * The time a reset was requested, or null. Anyone can forge the cookie, and the worst a forged time can do
 * is choose which of two error pages a failed link shows.
 */
export function readRecoveryRequestedAt(cookieValue: string | undefined): number | null {
  return parseRecoveryRequestedAt(cookieValue);
}
