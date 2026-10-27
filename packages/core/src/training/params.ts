import type { MuscleId, MuscleSizeClass } from "./muscles";

/*
 * Every tunable of the heat model (ADR 0005, "The heat model (pure, versioned)") in one object, under
 * the purity and versioning rule of ADR 0002. A change to any value below is a new version, never an
 * edit of `keylow-training-v1` in place, because anything computed with these params records their
 * version and must stay reproducible. If this file and the ADR table ever differ, the ADR wins.
 *
 * `keylow-training-v2` (ADR 0005, Amendment 6) changes only the volume numbers: the RP-style landmarks
 * of v1 give way to five bands. The effort weights and the heat numbers are v1's, copied from it.
 * `TRAINING_PARAMS_V1` stays as the record of what v1 held. Everything that computes now runs on v2.
 */

/**
 * The version of the v1 params, and of the goal presets, which v2 did not change.
 * `training_goals.params_version` records it.
 */
export const TRAINING_PARAMS_VERSION = "keylow-training-v1";

/** The version every `TrainingParams` carries. */
export const TRAINING_PARAMS_VERSION_V2 = "keylow-training-v2";

/**
 * How hard a set counts. A warm-up counts nothing. A working, drop or failure set counts by its
 * effort measure: `hard` at RIR up to `hardMaxRir` (or RPE from `hardMinRpe`), `moderate` at RIR up to
 * `moderateMaxRir` (or RPE from `moderateMinRpe`), and `easy` beyond, and `unknown` when it has
 * neither. RPE is read as 10 minus RIR, so RPE 7 is RIR 3, RPE 6 is RIR 4 and RPE 5 is RIR 5. A half
 * step between bands falls into the easier one: RPE 6.5 is RIR 3.5, above 3, so moderate, and RPE 4.5
 * is RIR 5.5, above 5, so easy.
 */
export type EffortParams = Readonly<{
  warmup: number;
  unknown: number;
  hard: number;
  moderate: number;
  easy: number;
  hardMaxRir: number;
  moderateMaxRir: number;
  hardMinRpe: number;
  moderateMinRpe: number;
}>;

/** The v1 weekly volume landmarks of a muscle, in effort-weighted sets: `mev <= mav.low <= mav.high <= mrv`. */
export type VolumeLandmarks = Readonly<{
  /** Minimum effective volume. */
  mev: number;
  /** Maximum adaptive volume, a range. */
  mav: Readonly<{ low: number; high: number }>;
  /** Maximum recoverable volume. */
  mrv: number;
}>;

/**
 * The v2 weekly volume bands of a muscle, in effort-weighted sets: `0 < growingFromSets <=
 * productiveFromSets <= highAboveSets`. Nothing is Not trained, below `growingFromSets` is Maintaining, from
 * there to below `productiveFromSets` is Growing, from there up to and including `highAboveSets` is Productive,
 * and above it is High.
 */
export type VolumeBands = Readonly<{
  growingFromSets: number;
  productiveFromSets: number;
  highAboveSets: number;
}>;

/** The numbers of the heat model for one muscle, which v1 and v2 share. */
type HeatNumbers = Readonly<{
  /** The time constant of fatigue decay, in hours. */
  tauHours: number;
  /** The fatigue, in effort-weighted sets, at which heat reaches 1. */
  capacity: number;
  /** The fatigue, in effort-weighted sets, at or below which a muscle is ready again. */
  threshold: number;
}>;

/** The v1 numbers for one muscle. */
export type MuscleParamsV1 = HeatNumbers & VolumeLandmarks;

/** The numbers for one muscle: its heat, and the volume bands it is read against. */
export type MuscleParams = HeatNumbers & Readonly<{ volume: VolumeBands }>;

type ParamsOf<Version extends string, Muscle> = Readonly<{
  version: Version;
  effort: EffortParams;
  sizeClasses: Readonly<Record<MuscleSizeClass, Muscle>>;
  /** Values for one muscle that differ from its size class. A field left out keeps the class value. */
  muscleOverrides: Readonly<Partial<Record<MuscleId, Partial<Muscle>>>>;
  /** Sets older than this many days add no fatigue. */
  heatWindowDays: number;
  /** Weekly sets count the sets of this many days. */
  volumeWindowDays: number;
}>;

/** The record of the v1 params. Nothing computes with it any more. */
export type TrainingParamsV1 = ParamsOf<typeof TRAINING_PARAMS_VERSION, MuscleParamsV1>;

export type TrainingParams = ParamsOf<typeof TRAINING_PARAMS_VERSION_V2, MuscleParams>;

/** θ is a quarter of C in v1. */
const THRESHOLD_SHARE_OF_CAPACITY = 0.25;

const sizeClass = (
  tauHours: number,
  capacity: number,
  landmarks: VolumeLandmarks,
): MuscleParamsV1 => ({
  tauHours,
  capacity,
  threshold: THRESHOLD_SHARE_OF_CAPACITY * capacity,
  ...landmarks,
});

/** The starting values of ADR 0005. They are a starting point to be tuned, not settled physiology. */
export const TRAINING_PARAMS_V1: TrainingParamsV1 = {
  version: TRAINING_PARAMS_VERSION,
  effort: {
    warmup: 0,
    unknown: 1,
    hard: 1,
    moderate: 0.5,
    easy: 0.25,
    hardMaxRir: 3,
    moderateMaxRir: 5,
    hardMinRpe: 7,
    moderateMinRpe: 5,
  },
  sizeClasses: {
    small: sizeClass(24, 8, { mev: 6, mav: { low: 10, high: 16 }, mrv: 22 }),
    medium: sizeClass(32, 10, { mev: 8, mav: { low: 12, high: 18 }, mrv: 22 }),
    large: sizeClass(40, 10, { mev: 6, mav: { low: 10, high: 16 }, mrv: 20 }),
  },
  muscleOverrides: {},
  heatWindowDays: 14,
  volumeWindowDays: 7,
};

/**
 * The bands of Zee's ruling of 2026-10-27 (KEY-726), the same for every muscle because the evidence does
 * not split by size class: about 4 fractional sets a week is the least that grows muscle (Pelland et al.),
 * 10 to 12 hard sets is where most of the benefit is, and about 20 is where returns diminish quickly.
 */
export const VOLUME_BANDS_V2: VolumeBands = {
  growingFromSets: 4,
  productiveFromSets: 10,
  highAboveSets: 20,
};

const heatAndBandsOf = ({ tauHours, capacity, threshold }: MuscleParamsV1): MuscleParams => ({
  tauHours,
  capacity,
  threshold,
  volume: VOLUME_BANDS_V2,
});

/** The v2 values: v1's effort weights, windows and heat, with the five volume bands in place of the landmarks. */
export const TRAINING_PARAMS_V2: TrainingParams = {
  version: TRAINING_PARAMS_VERSION_V2,
  effort: TRAINING_PARAMS_V1.effort,
  sizeClasses: {
    small: heatAndBandsOf(TRAINING_PARAMS_V1.sizeClasses.small),
    medium: heatAndBandsOf(TRAINING_PARAMS_V1.sizeClasses.medium),
    large: heatAndBandsOf(TRAINING_PARAMS_V1.sizeClasses.large),
  },
  muscleOverrides: {},
  heatWindowDays: TRAINING_PARAMS_V1.heatWindowDays,
  volumeWindowDays: TRAINING_PARAMS_V1.volumeWindowDays,
};
