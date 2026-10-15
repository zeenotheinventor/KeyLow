import { TERMS_VERSION } from "@keylow/core/copy";

/**
 * Carries the ticked acceptance across the Google round trip. The sign up page sets it, and the
 * callback route reads it, records the acceptance and clears it.
 */
export const TERMS_PENDING_COOKIE = "kl-terms-pending";

const TEN_MINUTES_IN_SECONDS = 600;

/** The `document.cookie` string that marks the current Terms as accepted for the next sign in. */
export function describeTermsPendingCookie(isSecure: boolean): string {
  const attributes = `path=/; max-age=${String(TEN_MINUTES_IN_SECONDS)}; SameSite=Lax`;

  return `${TERMS_PENDING_COOKIE}=${TERMS_VERSION}; ${attributes}${isSecure ? "; Secure" : ""}`;
}

/** The `document.cookie` string that removes the mark. */
export function describeClearedTermsPendingCookie(): string {
  return `${TERMS_PENDING_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * The version to record, or null. Only the current version counts, so a cookie someone forged
 * cannot record any other version.
 */
export function readPendingTermsVersion(cookieValue: string | undefined): string | null {
  return cookieValue === TERMS_VERSION ? TERMS_VERSION : null;
}
