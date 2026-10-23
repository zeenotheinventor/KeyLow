import { isCalendarDay } from "../dates";
import {
  BODY_FAT_MAX_PCT,
  BODY_FAT_MIN_PCT,
  LEAN_MASS_MAX_KG,
  LEAN_MASS_MIN_KG,
} from "./bodyBounds";
import { dailyMedians } from "../engine/dailyMedians";
import { segmentTrend } from "../engine/segmentTrend";
import { splitSegments } from "../engine/splitSegments";

import type { TrendParams } from "../engine";
import type { BodyMeasurementKind, BodyReading, BodyTrendPoint } from "./bodyTypes";

/*
 * Display only. These are not the engine's params and are never stored on a snapshot, because body
 * composition does not feed the engine. Alpha, the settling count and the gap are the weight trend's,
 * so one explainer covers all three. Nothing is rejected as a spike: rejectPct is infinite.
 */
type KindRules = Readonly<{ min: number; max: number; params: TrendParams }>;

const SHARED_PARAMS = {
  alpha: 0.1,
  rejectPct: Number.POSITIVE_INFINITY,
  winsorMinObs: 5,
  maxGapDays: 30,
} as const;

const RULES: Readonly<Record<BodyMeasurementKind, KindRules>> = {
  body_fat_pct: {
    min: BODY_FAT_MIN_PCT,
    max: BODY_FAT_MAX_PCT,
    params: { ...SHARED_PARAMS, winsorPct: 0.1 },
  },
  lean_mass_kg: {
    min: LEAN_MASS_MIN_KG,
    max: LEAN_MASS_MAX_KG,
    params: { ...SHARED_PARAMS, winsorPct: 0.05 },
  },
};

/**
 * Throws a RangeError for a `localDate` that is not a real `YYYY-MM-DD` day or a value that is not
 * finite. The message states the rule only, because a value is health data and must not reach a log.
 */
function assertReadings(readings: readonly BodyReading[]): void {
  for (const { localDate, value } of readings) {
    if (!isCalendarDay(localDate)) {
      throw new RangeError("A body reading date must be a real calendar day written YYYY-MM-DD.");
    }
    if (!Number.isFinite(value)) {
      throw new RangeError("A body reading value must be a finite number.");
    }
  }
}

/**
 * The smoothed trend of a body composition kind, always a full recompute from the raw readings. It is
 * the weight trend's engine with the kind's own bounds and winsor band (10 per cent of the trend for
 * body fat, 5 per cent for lean mass), and with no spike rejection, so every reading in the bounds
 * counts towards `nObs`. Pure: no clock, no randomness, nothing rounded. `readings` are live readings
 * in any order with any number a day. A reading outside the kind's bounds is ignored, and a malformed
 * date or a value that is not finite throws a RangeError. The points come out in date order across
 * all segments.
 */
export function computeBodyTrend(
  readings: readonly BodyReading[],
  kind: BodyMeasurementKind,
): BodyTrendPoint[] {
  assertReadings(readings);
  const { min, max, params } = RULES[kind];
  // The engine names its values kilograms. They are mapped to `value` here, at the edge.
  const inBounds = readings
    .filter(({ value }) => value >= min && value <= max)
    .map(({ localDate, value }) => ({ localDate, weightKg: value }));

  return splitSegments(dailyMedians(inBounds), params.maxGapDays).flatMap((days, segment) =>
    segmentTrend(days, segment, params).map(
      ({ date, trendKg, rawKg, interpolated, nObs }): BodyTrendPoint => ({
        date,
        segment,
        trend: trendKg,
        raw: rawKg,
        interpolated,
        nObs,
      }),
    ),
  );
}
