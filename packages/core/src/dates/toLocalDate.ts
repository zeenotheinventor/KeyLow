/**
 * Returns the calendar date (`YYYY-MM-DD`) of an instant in the given IANA time zone.
 * Supports years 1000 to 9999.
 * Pure: both arguments are required, there is no default time zone and no clock access.
 */
export function toLocalDate(instant: Date, timeZone: string): string {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError("Invalid instant: the Date has no valid time value");
  }

  const parts = createDateFormatter(timeZone).formatToParts(instant);

  return `${findPart(parts, "year")}-${findPart(parts, "month")}-${findPart(parts, "day")}`;
}

function createDateFormatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch (error) {
    if (error instanceof RangeError) {
      throw new RangeError(`Invalid time zone: "${timeZone}"`, { cause: error });
    }
    throw error;
  }
}

function findPart(parts: Intl.DateTimeFormatPart[], type: "year" | "month" | "day"): string {
  const part = parts.find((candidate) => candidate.type === type);
  if (part === undefined) {
    throw new Error(`Intl.DateTimeFormat returned no ${type} part`);
  }
  return part.value;
}
