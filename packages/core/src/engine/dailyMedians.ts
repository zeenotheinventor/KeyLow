import type { TrendInput } from "./types";

/** One reading day: the median of everything weighed on that date. */
export type DailyReading = Readonly<{ date: string; rawKg: number }>;

function median(weights: number[]): number {
  weights.sort((first, second) => first - second);
  const middle = weights.slice(
    Math.ceil(weights.length / 2) - 1,
    Math.floor(weights.length / 2) + 1,
  );
  return middle.reduce((sum, weight) => sum + weight, 0) / middle.length;
}

/**
 * The median reading of each date, in date order. The median of an even count is the mean of the
 * middle two. Dates are `YYYY-MM-DD`, so sorting them as text sorts them as days.
 */
export function dailyMedians(weighIns: readonly TrendInput[]): DailyReading[] {
  const weightsByDate = new Map<string, number[]>();
  for (const { localDate, weightKg } of weighIns) {
    const weights = weightsByDate.get(localDate);
    if (weights === undefined) {
      weightsByDate.set(localDate, [weightKg]);
    } else {
      weights.push(weightKg);
    }
  }

  return [...weightsByDate]
    .sort(([firstDate], [secondDate]) => (firstDate < secondDate ? -1 : 1))
    .map(([date, weights]) => ({ date, rawKg: median(weights) }));
}
