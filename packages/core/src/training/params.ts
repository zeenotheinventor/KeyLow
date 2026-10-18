import type { MuscleId, MuscleSizeClass } from "./muscles";

/*
 * Every tunable of the heat model (ADR 0005, "The heat model (pure, versioned)") in one object, under
 * the purity and versioning rule of ADR 0002. A change to any value below is a new version, never an
 * edit of `keylow-training-v1` in place, because anything computed with these params records their
 * version and must stay reproducible. If this file and the ADR table ever differ, the ADR wins.
 */

/** The version every `TrainingParams` carries. `training_goals.params_version` records it. */
export const TRAINING_PARAMS_VERSION = "keylow-training-v1";

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

/** The weekly volume landmarks of a muscle, in effort-weighted sets: `mev <= mav.low <= mav.high <= mrv`. */
export type VolumeLandmarks = Readonly<{
  /** Minimum effective volume. */
  mev: number;
  /** Maximum adaptive volume, a range. */
  mav: Readonly<{ low: number; high: number }>;
  /** Maximum recoverable volume. */
  mrv: number;
}>;

/** The heat model's numbers for one muscle. */
export type MuscleParams = VolumeLandmarks &
  Readonly<{
    /** The time constant of fatigue decay, in hours. */
    tauHours: number;
    /** The fatigue, in effort-weighted sets, at which heat reaches 1. */
    capacity: number;
    /** The fatigue, in effort-weighted sets, at or below which a muscle is ready again. */
    threshold: number;
  }>;

export type TrainingParams = Readonly<{
  version: typeof TRAINING_PARAMS_VERSION;
  effort: EffortParams;
  sizeClasses: Readonly<Record<MuscleSizeClass, MuscleParams>>;
  /** Values for one muscle that differ from its size class. A field left out keeps the class value. */
  muscleOverrides: Readonly<Partial<Record<MuscleId, Partial<MuscleParams>>>>;
  /** Sets older than this many days add no fatigue. */
  heatWindowDays: number;
  /** Weekly sets count the sets of this many days. */
  volumeWindowDays: number;
}>;

/** θ is a quarter of C in v1. */
const THRESHOLD_SHARE_OF_CAPACITY = 0.25;

const sizeClass = (
  tauHours: number,
  capacity: number,
  landmarks: VolumeLandmarks,
): MuscleParams => ({
  tauHours,
  capacity,
  threshold: THRESHOLD_SHARE_OF_CAPACITY * capacity,
  ...landmarks,
});

/** The starting values of ADR 0005. They are a starting point to be tuned, not settled physiology. */
export const TRAINING_PARAMS_V1: TrainingParams = {
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
