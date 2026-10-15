// Every segment of an IANA name starts with a capital letter (Europe/London, UTC, Etc/GMT+5).
const IANA_NAME_SHAPE = /^[A-Z][A-Za-z0-9_+-]*(\/[A-Z][A-Za-z0-9_+-]*)*$/;

/**
 * Whether a value is an IANA time zone name this runtime knows (`Europe/London`, `UTC`). It never
 * throws, so it can guard a value from outside, such as the device's zone, whose type may not be
 * trusted. The empty string, a padded value, a name with a segment that does not start with a capital
 * letter (Intl takes `europe/london`, but a stored zone should be the IANA spelling), a fixed offset such
 * as `+01:00` and anything that is not a string are all refused. Only the first letter of each segment is
 * checked, so the rest may be in any case, and an all-capitals name such as `EUROPE/LONDON` passes when
 * Intl knows it (it does). A name Intl knows under an older alias (Asia/Kolkata for Asia/Calcutta) is
 * accepted. Pure.
 */
export function isValidTimeZone(value: unknown): boolean {
  if (typeof value !== "string" || !IANA_NAME_SHAPE.test(value)) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch (error) {
    if (error instanceof RangeError) {
      return false;
    }
    throw error;
  }
}
