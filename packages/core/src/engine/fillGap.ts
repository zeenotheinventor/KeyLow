import { addCalendarDays } from "../dates";

/** A day and the weight the trend is fed on it. */
export type UsedDay = Readonly<{ date: string; usedKg: number }>;

/**
 * Every calendar day strictly between two accepted days, in date order, on the straight line from
 * one `usedKg` to the other. The fill keeps the EWMA's day clock honest and is never used by a slope.
 */
export function fillGap(previous: UsedDay, next: UsedDay): UsedDay[] {
  const dates: string[] = [];
  for (
    let date = addCalendarDays(previous.date, 1);
    date < next.date;
    date = addCalendarDays(date, 1)
  ) {
    dates.push(date);
  }

  const steps = dates.length + 1;
  const change = next.usedKg - previous.usedKg;
  return dates.map((date, index) => ({
    date,
    usedKg: previous.usedKg + (change * (index + 1)) / steps,
  }));
}
