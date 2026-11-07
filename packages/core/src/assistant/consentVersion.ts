/**
 * The version of the assistant's consent words that people accept when they turn the assistant on. It is
 * the date the current wording took effect. A later version asks everyone to turn it on again. It is
 * separate from `TERMS_VERSION`, or every later change to the Terms would switch the assistant off.
 */
export const ASSISTANT_CONSENT_VERSION = "2026-11-07";

/**
 * Whether a stored consent version is the current one or later. A version is a `YYYY-MM-DD` day, so
 * comparing the text compares the days. No version means the person never consented.
 */
export function isAssistantConsentCurrent(version: string | null): boolean {
  return version !== null && version >= ASSISTANT_CONSENT_VERSION;
}
