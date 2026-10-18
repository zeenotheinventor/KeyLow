import type { TrendParams } from "./params";

export type ReadingToScreen = Readonly<{
  /** The day's median reading. */
  rawKg: number;
  /** The trend on the most recent day that had an accepted reading. Undefined before the first one. */
  lastTrendKg: number | undefined;
  /** Accepted reading days before this one in the same segment. */
  acceptedBefore: number;
  /** The next reading day's median in the same segment, or undefined when this is the last one. */
  nextRawKg: number | undefined;
}>;

export type ScreenedReading =
  Readonly<{ rejected: true }> | Readonly<{ rejected: false; usedKg: number; winsorised: boolean }>;

/**
 * Decides what the trend is fed on a reading day. With fewer than `winsorMinObs` accepted readings
 * before it, the reading is used as it is. From then on it is rejected as a spike when it is further
 * than `rejectPct` from the last trend and the next reading day does not agree with it. The next
 * reading agrees when `|next - raw| <= rejectPct * lastTrend`. The last reading of a segment is never
 * rejected, because nothing can disagree with it yet. Any other reading is clamped to `winsorPct`
 * either side of the last trend.
 */
export function screenReading(reading: ReadingToScreen, params: TrendParams): ScreenedReading {
  const { rawKg, lastTrendKg, acceptedBefore, nextRawKg } = reading;
  if (lastTrendKg === undefined || acceptedBefore < params.winsorMinObs) {
    return { rejected: false, usedKg: rawKg, winsorised: false };
  }

  const isSpike = Math.abs(rawKg - lastTrendKg) / lastTrendKg > params.rejectPct;
  const nextAgrees =
    nextRawKg === undefined || Math.abs(nextRawKg - rawKg) <= params.rejectPct * lastTrendKg;
  if (isSpike && !nextAgrees) {
    return { rejected: true };
  }

  const usedKg = Math.min(
    Math.max(rawKg, lastTrendKg * (1 - params.winsorPct)),
    lastTrendKg * (1 + params.winsorPct),
  );
  return { rejected: false, usedKg, winsorised: usedKg !== rawKg };
}
