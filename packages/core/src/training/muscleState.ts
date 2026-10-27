import { z } from "zod";

import { MUSCLE_IDS, MUSCLES } from "./muscles";
import { setEffort } from "./setEffort";

import type { MuscleId } from "./muscles";
import type { MuscleParams, TrainingParams, VolumeBands } from "./params";
import type { EffortSet } from "./setEffort";
import type { SetSnapshot, WorkoutSetRow } from "../schemas/training";

/*
 * The heat and volume model of ADR 0005, "The heat model (pure, versioned)". Everything here is pure under
 * the ADR 0002 rule: `now` and `asOf` are arguments, and nothing reads the clock, a store or a random
 * source. A set's muscles are read from its snapshot, never from the live exercise, so editing an exercise
 * never rewrites past heat.
 */

/**
 * Where a muscle's weekly sets sit among the five bands of `keylow-training-v2` (ADR 0005, Amendment 6),
 * from the least to the most. The index of a status in this list is the value the volume scale of the body
 * map carries (`volumeValues`), so a change to the order is a change to the encoding.
 */
export const VOLUME_STATUSES = [
  "not_trained",
  "maintaining",
  "growing",
  "productive",
  "high",
] as const;

export type VolumeStatus = (typeof VOLUME_STATUSES)[number];

/**
 * The fields of a set the model reads. A logged `workout_sets` row has them all, and so will a planned
 * set, which carries a snapshot taken from the exercise's current map.
 */
export type HeatSet = EffortSet &
  Pick<WorkoutSetRow, "performed_at" | "deleted_at"> & {
    snapshot: Pick<SetSnapshot, "muscles">;
  };

export type MuscleVolume = {
  /** Effort-weighted sets in the volume window: the sum of `weight × effort` over its sets. */
  weeklySets: number;
  volumeStatus: VolumeStatus;
};

export type MuscleState = MuscleVolume & {
  /** Acute fatigue over capacity, from 0 (fully recovered) to 1. */
  heat: number;
  /** When fatigue falls to the ready threshold, as an ISO timestamp in UTC. `now` when it is already there. */
  readyAt: string;
};

const MILLISECONDS_PER_HOUR = 3_600_000;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;

/*
 * Weekly sets are rounded to nine decimal places, so floating point drift never moves a status
 * across a band edge: ten sets at a weight of 0.1 are exactly 1, not 0.9999999999999999.
 */
const WEEKLY_SETS_SCALE = 1e9;

/** A muscle's numbers: its size class's, with any field of its override in their place. */
export const muscleParams = (muscle: MuscleId, params: TrainingParams): MuscleParams => {
  const classParams = params.sizeClasses[MUSCLES[muscle].sizeClass];
  const override = params.muscleOverrides[muscle];
  return override === undefined ? classParams : { ...classParams, ...override };
};

/**
 * Not trained at 0 sets, Maintaining from just above 0 to below `growingFromSets`, Growing from there to
 * below `productiveFromSets`, Productive from there up to and including `highAboveSets`, and High above it.
 * The plan does not change the status: a muscle with no sets is Not trained whether or not the routine or
 * the goal trains it.
 */
export const volumeStatusOf = (weeklySets: number, bands: VolumeBands): VolumeStatus => {
  if (weeklySets <= 0) {
    return "not_trained";
  }
  if (weeklySets < bands.growingFromSets) {
    return "maintaining";
  }
  if (weeklySets < bands.productiveFromSets) {
    return "growing";
  }
  return weeklySets <= bands.highAboveSets ? "productive" : "high";
};

// The schemas' timestamp rule: a zone designator is required, so a time never depends on the device zone.
const timestampSchema = z.iso.datetime({ offset: true });

const parseTimestamp = (timestamp: string, rule: string): number => {
  if (!timestampSchema.safeParse(timestamp).success) {
    throw new RangeError(rule);
  }
  return Date.parse(timestamp);
};

/**
 * A moment as epoch milliseconds, or a `RangeError` naming the rule. Not exported from the package.
 * `rule` is the message, so a caller reading another field can name that field.
 */
export const parseMoment = (
  moment: string,
  rule = "The moment to compute at must be an ISO timestamp with a zone",
): number => parseTimestamp(moment, rule);

/** One set's stimulus on one muscle, `weight × effort`, with the time it landed. */
type Stimulus = { at: number; amount: number };

/**
 * The stimulus each muscle took from each live set up to `upTo`. A soft-deleted set, a warm-up and a set
 * after `upTo` add nothing.
 */
const stimuliUpTo = (
  sets: readonly HeatSet[],
  upTo: number,
  params: TrainingParams,
): Map<MuscleId, Stimulus[]> => {
  const stimuli = new Map<MuscleId, Stimulus[]>(MUSCLE_IDS.map((muscle) => [muscle, []]));
  for (const set of sets) {
    if (set.deleted_at !== null) {
      continue;
    }
    const at = parseTimestamp(
      set.performed_at,
      "A set's performed_at must be an ISO timestamp with a zone",
    );
    const effort = setEffort(set, params);
    if (at > upTo || effort === 0) {
      continue;
    }
    for (const { muscle_id, weight } of set.snapshot.muscles) {
      stimuli.get(muscle_id)?.push({ at, amount: weight * effort });
    }
  }
  return stimuli;
};

/** The stimuli within a window of `days` that ends at `end`: the end included, the start not. */
const withinDays = (stimuli: readonly Stimulus[], end: number, days: number): Stimulus[] =>
  stimuli.filter((stimulus) => stimulus.at > end - days * MILLISECONDS_PER_DAY);

/*
 * Floating point addition is not associative, so terms are summed smallest first. The same sets in any
 * order then give the same bits, and adding a term never lowers the total.
 */
const sumOf = (terms: readonly number[]): number =>
  [...terms].sort((first, second) => first - second).reduce((total, term) => total + term, 0);

const byMuscle = <Value>(valueOf: (muscle: MuscleId) => Value): Record<MuscleId, Value> =>
  // Every id of the list is mapped, so the entries make the full record.
  Object.fromEntries(MUSCLE_IDS.map((muscle) => [muscle, valueOf(muscle)])) as Record<
    MuscleId,
    Value
  >;

/** The effort-weighted set count of some stimuli, rounded as weekly sets are. */
const weightedSetsOf = (stimuli: readonly Stimulus[]): number =>
  Math.round(sumOf(stimuli.map((stimulus) => stimulus.amount)) * WEEKLY_SETS_SCALE) /
  WEEKLY_SETS_SCALE;

const volumeOf = (
  stimuli: Map<MuscleId, Stimulus[]>,
  asOf: number,
  params: TrainingParams,
): Record<MuscleId, MuscleVolume> =>
  byMuscle((muscle) => {
    const weeklySets = weightedSetsOf(
      withinDays(stimuli.get(muscle) ?? [], asOf, params.volumeWindowDays),
    );
    return {
      weeklySets,
      volumeStatus: volumeStatusOf(weeklySets, muscleParams(muscle, params).volume),
    };
  });

/**
 * Each muscle's effort-weighted sets over every live set given, whenever it was performed: the sum of
 * `weight × effort`, rounded as weekly sets are. The caller chooses the sets, so `compareWeek` can count
 * a calendar week, which a clock change makes 167 or 169 hours long, where `weeklyVolume` counts a
 * rolling window. Not exported from the package: `compareWeek` is its public use.
 */
export const weightedSetsByMuscle = (
  sets: readonly HeatSet[],
  params: TrainingParams,
): Record<MuscleId, number> => {
  const stimuli = stimuliUpTo(sets, Number.POSITIVE_INFINITY, params);
  return byMuscle((muscle) => weightedSetsOf(stimuli.get(muscle) ?? []));
};

/**
 * Each muscle's effort-weighted sets over the volume window ending at `asOf` (the last 7 days in v1,
 * `asOf` included and the moment exactly a window earlier not), and its volume status.
 * Every muscle id is present, at 0 sets when nothing trained it.
 */
export const weeklyVolume = (
  sets: readonly HeatSet[],
  asOf: string,
  params: TrainingParams,
): Record<MuscleId, MuscleVolume> => {
  const at = parseMoment(asOf);
  return volumeOf(stimuliUpTo(sets, at, params), at, params);
};

/**
 * Each muscle's heat, the time it is ready again, its weekly sets and its volume status at `now`.
 *
 * Fatigue is `F = Σ s · exp(−(now − t) / τ)` over the live sets of the heat window (the last 14 days
 * in v1, `now` included), where `s = weight × effort` is a set's stimulus on the muscle and `t` the
 * time it was performed. Heat is `F / C` held between 0 and 1. The muscle is ready at
 * `now + τ · ln(F / θ)`, rounded up to the next millisecond so fatigue is never above θ at that moment,
 * and at `now` when F is already at or below θ. A set after `now` has not happened yet and adds nothing.
 *
 * Throws a `RangeError` naming the rule when `now` or a set's `performed_at` is not an ISO timestamp
 * with a zone.
 */
export const muscleState = (
  sets: readonly HeatSet[],
  now: string,
  params: TrainingParams,
): Record<MuscleId, MuscleState> => {
  const at = parseMoment(now);
  const nowIso = new Date(at).toISOString();
  const stimuli = stimuliUpTo(sets, at, params);
  const volume = volumeOf(stimuli, at, params);
  return byMuscle((muscle) => {
    const { tauHours, capacity, threshold } = muscleParams(muscle, params);
    const tau = tauHours * MILLISECONDS_PER_HOUR;
    const window = withinDays(stimuli.get(muscle) ?? [], at, params.heatWindowDays);
    const fatigue = sumOf(
      window.map((stimulus) => stimulus.amount * Math.exp(-(at - stimulus.at) / tau)),
    );
    const heat = Math.min(Math.max(fatigue / capacity, 0), 1);
    const readyAt =
      fatigue > threshold
        ? new Date(at + Math.ceil(tau * Math.log(fatigue / threshold))).toISOString()
        : nowIso;
    return { heat, readyAt, ...volume[muscle] };
  });
};
