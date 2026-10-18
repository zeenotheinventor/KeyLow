import { fillGap } from "./fillGap";
import { screenReading } from "./screenReading";
import { createTrendSmoother } from "./trendSmoother";

import type { DailyReading } from "./dailyMedians";
import type { UsedDay } from "./fillGap";
import type { TrendParams } from "./params";
import type { TrendPoint } from "./types";

/**
 * The trend for every calendar day of one segment, from its first reading day to its last. `days`
 * must be non-empty and in date order. Each reading day is screened against the trend on the last
 * accepted day. A rejected day is held back and filled, like a missing one, once the next accepted
 * reading is known. The last reading of a segment is never rejected, so the segment always ends on
 * an accepted day. The EWMA restarts from the first reading, so a segment never sees another one.
 */
export function segmentTrend(
  days: readonly DailyReading[],
  segment: number,
  params: TrendParams,
): TrendPoint[] {
  const smooth = createTrendSmoother(params.alpha);
  const points: TrendPoint[] = [];
  const rejectedRawKgByDate = new Map<string, number>();
  let previous: UsedDay | undefined;
  let lastTrendKg: number | undefined;
  let acceptedCount = 0;

  days.forEach(({ date, rawKg }, index) => {
    const screened = screenReading(
      { rawKg, lastTrendKg, acceptedBefore: acceptedCount, nextRawKg: days[index + 1]?.rawKg },
      params,
    );
    if (screened.rejected) {
      rejectedRawKgByDate.set(date, rawKg);
      return;
    }

    if (previous !== undefined) {
      for (const filled of fillGap(previous, { date, usedKg: screened.usedKg })) {
        const rejectedRawKg = rejectedRawKgByDate.get(filled.date);
        points.push({
          date: filled.date,
          segment,
          trendKg: smooth(filled.usedKg),
          rawKg: rejectedRawKg ?? null,
          usedKg: filled.usedKg,
          rejected: rejectedRawKg !== undefined,
          winsorised: false,
          interpolated: true,
          nObs: acceptedCount,
        });
      }
    }

    acceptedCount += 1;
    lastTrendKg = smooth(screened.usedKg);
    points.push({
      date,
      segment,
      trendKg: lastTrendKg,
      rawKg,
      usedKg: screened.usedKg,
      rejected: false,
      winsorised: screened.winsorised,
      interpolated: false,
      nObs: acceptedCount,
    });
    previous = { date, usedKg: screened.usedKg };
  });

  return points;
}
