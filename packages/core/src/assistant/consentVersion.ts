/**
 * The version of the assistant's consent words that people accept when they turn the assistant on. It is
 * the date the current wording took effect. A later version asks everyone to turn it on again. It is
 * separate from `TERMS_VERSION`, or every later change to the Terms would switch the assistant off.
 *
 * Moving it means moving `TERMS_VERSION` in `copy/legal.ts` when the Terms change too, and then the pins
 * in `test/copy/legal.test.ts` (the version and the "Last updated" line). The other tests read it from here.
 */
export const ASSISTANT_CONSENT_VERSION = "2026-11-07";

const DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether a stored consent version is the current one or later. A version is a `YYYY-MM-DD` day, so
 * comparing the text compares the days. No version, and any text that is not a day, is not consent.
 */
export function isAssistantConsentCurrent(version: string | null): boolean {
  return version !== null && DAY_SHAPE.test(version) && version >= ASSISTANT_CONSENT_VERSION;
}
