/*
 * Every tunable of the adaptive engine in one object, so that a retune is a new version and never an
 * edit that rewrites history. Anything computed with these params records their version. The
 * `expenditure` group holds the values the starting estimate and `deriveTargets` use (ADR 0002,
 * Amendment 1). M6 adds the measurement and update params later, with their functions.
 */

import type { ActivityLevel, Sex } from "./types";

/** The version every `EngineParams` carries. */
export const ENGINE_VERSION = "keylow-engine-v1";

/** The tunables of the trend weight. */
export type TrendParams = Readonly<{
  /** The EWMA smoothing factor, between 0 and 1. A larger value follows the readings more closely. */
  alpha: number;
  /** Every reading is clamped to this fraction either side of the last trend (0.025 is 2.5%). */
  winsorPct: number;
  /** A reading further than this fraction from the last trend can be rejected as a spike. */
  rejectPct: number;
  /** Accepted readings a segment needs before spikes are rejected or clamped. */
  winsorMinObs: number;
  /** A gap of more than this many calendar days between two reading dates starts a new segment. */
  maxGapDays: number;
}>;

/** The tunables of the starting estimate of daily energy expenditure. */
export type ExpenditureParams = Readonly<{
  /** Kilocalories in one kilogram of body weight change. */
  energyDensityKcalPerKg: number;
  /** The prior's standard deviation as a fraction of its mean (0.15 is 15%). */
  priorCv: number;
  /** The expenditure estimate is clamped to this range of kilocalories a day. */
  zClampKcal: Readonly<{ min: number; max: number }>;
  /** The constant of the Mifflin-St Jeor equation for each sex, in kilocalories a day. */
  sexOffsetKcal: Readonly<Record<Sex, number>>;
  /** The BMR multiplier for each activity level. */
  activityFactors: Readonly<Record<ActivityLevel, number>>;
  /** An activity factor override is clamped to this range. */
  activityFactorBand: Readonly<{ min: number; max: number }>;
}>;

export type EngineParams = Readonly<{
  version: typeof ENGINE_VERSION;
  trend: TrendParams;
  expenditure: ExpenditureParams;
}>;

export const DEFAULT_ENGINE_PARAMS: EngineParams = {
  version: ENGINE_VERSION,
  trend: { alpha: 0.1, winsorPct: 0.025, rejectPct: 0.15, winsorMinObs: 5, maxGapDays: 30 },
  expenditure: {
    energyDensityKcalPerKg: 7700,
    priorCv: 0.15,
    zClampKcal: { min: 800, max: 6000 },
    sexOffsetKcal: { male: 5, female: -161, other: -78 },
    activityFactors: { sedentary: 1.2, light: 1.375, moderate: 1.55, very: 1.725, extra: 1.9 },
    activityFactorBand: { min: 1.2, max: 1.9 },
  },
};
