const HOURS_PER_DAY = 24;

type ZonedClock = { year: number; month: number; day: number; hour: number; minute: number };

/**
 * The wall clock in the given IANA time zone at an instant, read from the numeric parts of Intl
 * only, like `toLocalDate`, so no locale data decides the result and Hermes and Node agree.
 * Seconds are dropped. Pure: both arguments are required and there is no clock access.
 */
export function readZonedClock(instant: Date, timeZone: string): ZonedClock {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError("Invalid instant: the Date has no valid time value");
  }

  const parts = createClockFormatter(timeZone).formatToParts(instant);

  return {
    year: readPart(parts, "year"),
    month: readPart(parts, "month"),
    day: readPart(parts, "day"),
    // Node never writes midnight as hour 24 here. This wraps it for an engine that might (Hermes
    // is unverified), and a test stubs Intl to cover it.
    hour: readPart(parts, "hour") % HOURS_PER_DAY,
    minute: readPart(parts, "minute"),
  };
}

// Building an Intl.DateTimeFormat is slow, and a diary screen reads the clock for many entries in the
// same zone, so one formatter is kept per zone. A zone that fails to build is never stored.
const formattersByZone = new Map<string, Intl.DateTimeFormat>();

function createClockFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formattersByZone.get(timeZone);
  if (cached !== undefined) {
    return cached;
  }
  const formatter = buildClockFormatter(timeZone);
  formattersByZone.set(timeZone, formatter);
  return formatter;
}

function buildClockFormatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    if (error instanceof RangeError) {
      throw new RangeError(`Invalid time zone: "${timeZone}"`, { cause: error });
    }
    throw error;
  }
}

function readPart(parts: Intl.DateTimeFormatPart[], type: keyof ZonedClock): number {
  const part = parts.find((candidate) => candidate.type === type);
  if (part === undefined) {
    throw new Error(`Intl.DateTimeFormat returned no ${type} part`);
  }
  return Number(part.value);
}
