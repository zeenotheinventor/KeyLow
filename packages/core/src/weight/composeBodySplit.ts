import { addCalendarDays } from "../dates";
import { BODY_FAT_MAX_PCT, BODY_FAT_MIN_PCT } from "./bodyBounds";
import { isBodyTrendSettling } from "./bodyTrendHelpers";
import { DEFAULT_ENGINE_PARAMS } from "../engine/params";

import type { TrendPoint } from "../engine";
import type {
  BodyMeasurementKind,
  BodySplit,
  BodySplitPoint,
  BodySplitUnit,
  BodyTrendPoint,
} from "./bodyTypes";

type Split = Readonly<{ fatKg: number; leanKg: number; fatPct: number }>;

const EMPTY_SPLIT: BodySplit = { driver: null, points: [], settling: false };

/**
 * The trend weight for a day: the weight trend's own point for the date, else the latest point before it
 * when that is no more than the trend's gap rule earlier, else null. The list is in date order.
 */
function weightForDay(weight: readonly TrendPoint[], date: string): number | null {
  let latestBefore: TrendPoint | undefined;
  for (const point of weight) {
    if (point.date === date) {
      return point.trendKg;
    }
    if (point.date < date) {
      latestBefore = point;
    }
  }
  if (latestBefore === undefined) {
    return null;
  }

  return date <= addCalendarDays(latestBefore.date, DEFAULT_ENGINE_PARAMS.trend.maxGapDays)
    ? latestBefore.trendKg
    : null;
}

/** Body fat drives: the trend is the per cent of the weight that is fat. */
function splitFromBodyFat(weightKg: number, bodyFatPct: number): Split {
  const fatKg = (weightKg * bodyFatPct) / 100;

  return { fatKg, leanKg: weightKg - fatKg, fatPct: bodyFatPct };
}

/** Lean mass drives: the fat is what the weight holds beyond the lean mass. */
function splitFromLeanMass(weightKg: number, leanMassKg: number): Split {
  const fatKg = weightKg - leanMassKg;

  return { fatKg, leanKg: leanMassKg, fatPct: (fatKg / weightKg) * 100 };
}

/** Only a lean mass can imply an impossible body fat, as when it is at or above the weight. */
function isPlausibleBodyFat(fatPct: number): boolean {
  // Written as a positive test so a body fat that is not a number is dropped too.
  return fatPct >= BODY_FAT_MIN_PCT && fatPct <= BODY_FAT_MAX_PCT;
}

function toPoint(split: Split, unit: BodySplitUnit, date: string, segment: number): BodySplitPoint {
  return unit === "kg"
    ? { date, segment, fat: split.fatKg, lean: split.leanKg }
    : { date, segment, fat: split.fatPct, lean: 100 - split.fatPct };
}

/**
 * The two lines of the composition chart, fat and lean, in kilograms or in per cent of the weight trend.
 * Body fat drives whenever its trend has a point, and lean mass drives only when body fat has none, so the
 * two kinds are never mixed day by day. A day with no usable weight, or with a lean mass that puts body
 * fat outside the plausible range, is dropped and the line breaks there. Full float, never rounded.
 */
export function composeBodySplit(input: {
  weight: readonly TrendPoint[];
  bodyFat: readonly BodyTrendPoint[];
  leanMass: readonly BodyTrendPoint[];
  unit: BodySplitUnit;
}): BodySplit {
  const { weight, bodyFat, leanMass, unit } = input;
  const driver: BodyMeasurementKind | null =
    bodyFat.length > 0 ? "body_fat_pct" : leanMass.length > 0 ? "lean_mass_kg" : null;
  if (driver === null) {
    return EMPTY_SPLIT;
  }

  const driverPoints = driver === "body_fat_pct" ? bodyFat : leanMass;
  const splitFrom = driver === "body_fat_pct" ? splitFromBodyFat : splitFromLeanMass;
  const points: BodySplitPoint[] = [];
  let outputSegment = 0;
  let previousDriverSegment: number | null = null;
  let breaksBeforeNextPoint = false;

  for (const driverPoint of driverPoints) {
    if (previousDriverSegment !== null && driverPoint.segment !== previousDriverSegment) {
      breaksBeforeNextPoint = true;
    }
    previousDriverSegment = driverPoint.segment;

    const weightKg = weightForDay(weight, driverPoint.date);
    const split = weightKg === null ? null : splitFrom(weightKg, driverPoint.trend);
    if (split === null || (driver === "lean_mass_kg" && !isPlausibleBodyFat(split.fatPct))) {
      breaksBeforeNextPoint = true;
      continue;
    }

    if (breaksBeforeNextPoint && points.length > 0) {
      outputSegment += 1;
    }
    breaksBeforeNextPoint = false;
    points.push(toPoint(split, unit, driverPoint.date, outputSegment));
  }

  return { driver, points, settling: isBodyTrendSettling(driverPoints) };
}
