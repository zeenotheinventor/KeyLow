const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_HOUR = 3_600_000;
const MILLISECOND_DIGITS = 3;

// An ISO 8601 instant that states its offset: `Z` or `+hh:mm` (the colon is optional).
const INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:Z|([+-])(\d{2}):?(\d{2}))$/;

const numberOf = (digits: string | undefined): number => Number(digits ?? "0");

/**
 * Reads an ISO 8601 instant that carries an offset or `Z`, such as a Health record's time. Returns
 * null for a time with no offset, a day that does not exist (30 February) or any other text. It does
 * not lean on `Date.parse`, which differs between engines on exactly these cases (V8 rolls 30
 * February over to 2 March) and may read a time with no offset in the device zone.
 */
export function parseInstant(text: string): Date | null {
  const parts = INSTANT.exec(text);
  if (parts === null) {
    return null;
  }

  const [year, month, day] = [numberOf(parts[1]), numberOf(parts[2]), numberOf(parts[3])];
  const [hour, minute, second] = [numberOf(parts[4]), numberOf(parts[5]), numberOf(parts[6])];
  const millisecond = numberOf(
    (parts[7] ?? "").padEnd(MILLISECOND_DIGITS, "0").slice(0, MILLISECOND_DIGITS),
  );
  const offsetHours = numberOf(parts[9]);
  const offsetMinutes = numberOf(parts[10]);

  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  const isRealTime =
    year >= 1000 &&
    wallClock.getUTCFullYear() === year &&
    wallClock.getUTCMonth() === month - 1 &&
    wallClock.getUTCDate() === day &&
    hour < 24 &&
    minute < 60 &&
    second < 60 &&
    offsetHours < 24 &&
    offsetMinutes < 60;
  if (!isRealTime) {
    return null;
  }

  const offsetSign = parts[8] === "-" ? -1 : 1;
  const offset =
    offsetSign * (offsetHours * MILLISECONDS_PER_HOUR + offsetMinutes * MILLISECONDS_PER_MINUTE);
  return new Date(wallClock.getTime() - offset);
}
