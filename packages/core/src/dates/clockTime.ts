const CLOCK_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type ClockTime = { hour: number; minute: number };

/**
 * Reads a 24-hour clock time written as "HH:mm", such as the `time` of a link or the value of the time
 * picker. Anything else, including a time that does not exist like "24:00", is undefined. Pure.
 */
export function parseClockTime(text: string): ClockTime | undefined {
  const match = CLOCK_TIME.exec(text);

  return match === null ? undefined : { hour: Number(match[1]), minute: Number(match[2]) };
}

/** Writes an hour (0 to 23) and a minute (0 to 59) as "HH:mm", the way `formatClockTime` does. */
export function joinClockTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
