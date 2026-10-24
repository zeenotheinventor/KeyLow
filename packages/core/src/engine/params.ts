/*
 * Every tunable of the adaptive engine in one object, so that a retune is a new version and never an
 * edit that rewrites history. Anything computed with these params records their version. The
 * `expenditure` and `targets` groups hold the values the starting estimate and `deriveTargets` use
 * (ADR 0002, Amendment 1). The energy density lives in `expenditure` only, and `deriveTargets` reads it
 * from there. The window, eligibility and variance params of `measureExpenditure` sit in `expenditure`
 * too (ADR 0002, Amendment 2). The update params come with `updateExpenditure`.
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
  /** The measurement looks at this many days before the check-in day, the check-in day itself excluded. */
  windowDays: number;
  /** The first and last real weigh-in in the window must be at least this many days apart, both ends counted. */
  minSpanDays: number;
  /**
   * The window needs at least this many days with a real weigh-in. Keep `minWeighDays` at 3 or more and
   * `minCompleteDays` at 1 or more: below that the measured figures are NaN. There is no runtime guard.
   */
  minWeighDays: number;
  /** The window needs at least this many complete days. */
  minCompleteDays: number;
  /** The residual standard deviation of the weight is never taken as less than this, in kilograms. */
  residualSdFloorKg: number;
  /** One day's logged intake is uncertain by this fraction of the mean intake (0.15 is 15%). */
  intakeCvPerDay: number;
  /** The standard deviation, in kilocalories a day, charged when every day since the first data is incomplete. */
  incompletePenaltyKcal: number;
}>;

/** The tunables of the daily calorie target and of the split of those calories into macros. */
export type TargetsParams = Readonly<{
  /** A lose target is never below this many kilocalories a day. */
  floorAbsKcal: number;
  /** A lose target is never below this multiple of the BMR. The floor is the larger of the two limits. */
  floorBmrFactor: number;
  /** A lose target is never more than this fraction of tdee below it (0.30 is 30%). */
  maxDeficitFrac: number;
  /** A gain target is never more than this fraction of tdee above it (0.20 is 20%). */
  maxSurplusFrac: number;
  /** The fastest loss the engine aims for, in percent of body weight a week. */
  maxLossPct: number;
  /** The fastest gain the engine aims for, in percent of body weight a week. */
  maxGainPct: number;
  /** Calories are rounded to a multiple of this many kilocalories. */
  roundToKcal: number;
  /** The protein presets, in grams of protein for each kilogram of trend weight. */
  proteinPresets: Readonly<{ moderate: number; high: number; very_high: number }>;
  /** Protein is never more than this many grams for each kilogram of trend weight. */
  proteinMaxGPerKg: number;
  /**
   * The fat fractions, each the share of the calories left after protein that goes to fat. The keys are
   * the stored `programs.split_preset` values.
   */
  fatFractions: Readonly<{ balanced: number; low_fat: number; low_carb: number }>;
  /** Fat is never less than this many grams for each kilogram of trend weight. */
  fatMinGPerKg: number;
}>;

export type EngineParams = Readonly<{
  version: typeof ENGINE_VERSION;
  trend: TrendParams;
  expenditure: ExpenditureParams;
  targets: TargetsParams;
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
    windowDays: 28,
    minSpanDays: 14,
    minWeighDays: 8,
    minCompleteDays: 10,
    residualSdFloorKg: 0.3,
    intakeCvPerDay: 0.15,
    incompletePenaltyKcal: 100,
  },
  targets: {
    floorAbsKcal: 1200,
    floorBmrFactor: 0.9,
    maxDeficitFrac: 0.3,
    maxSurplusFrac: 0.2,
    maxLossPct: 1.0,
    maxGainPct: 0.5,
    roundToKcal: 10,
    proteinPresets: { moderate: 1.6, high: 2.0, very_high: 2.2 },
    proteinMaxGPerKg: 3.0,
    fatFractions: { balanced: 0.4, low_fat: 0.28, low_carb: 0.6 },
    fatMinGPerKg: 0.5,
  },
};
