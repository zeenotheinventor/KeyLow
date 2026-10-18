/** One live weigh-in as the engine reads it. The caller has already dropped soft-deleted ones. */
export type TrendInput = Readonly<{
  /** The day of the reading in the user's time zone, written `YYYY-MM-DD`. */
  localDate: string;
  weightKg: number;
}>;

/** One calendar day of the trend. Weights are full float, never rounded. */
export type TrendPoint = Readonly<{
  date: string;
  /** Which run of readings this day belongs to. A gap over `maxGapDays` starts the next one, from 0. */
  segment: number;
  trendKg: number;
  /** The day's median reading, or null when the day had none. */
  rawKg: number | null;
  /** What the EWMA was fed: the reading, the clamped reading, or the value filled in for a missing day. */
  usedKg: number;
  rejected: boolean;
  winsorised: boolean;
  /** True when `usedKg` was filled in between two accepted readings, not measured. */
  interpolated: boolean;
  /** Accepted reading days in the segment up to and including this day. */
  nObs: number;
}>;
