import { addCalendarDays, ageInYears, isCalendarDay } from "../dates";
import { bmrMifflinStJeor, initialExpenditure } from "./initialExpenditure";
import { DEFAULT_ENGINE_PARAMS } from "./params";
import { ACTIVITY_LEVELS, SEXES } from "./types";

import type { EngineParams } from "./params";
import type { ActivityLevel, Sex } from "./types";

/** A start snapshot older than this many days is not rewritten. A new one is made instead. */
const START_SNAPSHOT_MAX_AGE_DAYS = 28;

/** The profile stats the starting estimate and the floor's BMR read. */
export type ProfileStats = Readonly<{
  sex: Sex;
  /** `YYYY-MM-DD`. */
  birthDate: string;
  heightCm: number;
  activity: ActivityLevel;
}>;

/** The profile columns `requireStats` reads, as the database holds them: any of them can be null. */
export type ProfileStatsRow = Readonly<{
  sex: string | null;
  birth_date: string | null;
  height_cm: number | null;
  activity: string | null;
  onboarding_weight_kg: number | null;
}>;

export type RequiredStats =
  | Readonly<{ ok: true; stats: ProfileStats; onboardingWeightKg: number }>
  | Readonly<{ ok: false; reason: "missing_stats" }>;

function isSex(value: string): value is Sex {
  return SEXES.some((sex) => sex === value);
}

function isActivityLevel(value: string): value is ActivityLevel {
  return ACTIVITY_LEVELS.some((level) => level === value);
}

/**
 * Mifflin-St Jeor of the profile's stats at `weightKg`, with the age on `asOfDate` (ADR 0002, Amendment 2,
 * "Key sets and the 6000 cap"). A check-in passes the onboarding weight and its own date, a recompute
 * passes today. The result is the `bmrKcal` that `checkinStep` and `recomputeTargets` read.
 */
export function profileBmr(
  { sex, birthDate, heightCm }: ProfileStats,
  weightKg: number,
  asOfDate: string,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): number {
  return bmrMifflinStJeor(
    { sex, ageYears: ageInYears(birthDate, asOfDate), heightCm, weightKg },
    params,
  );
}

/**
 * The stats a snapshot and the floor need, or `missing_stats` when any of the five is null (ADR 0002,
 * Amendment 2, "The prior for an account with no stats"). A sex or an activity level the engine does not
 * know counts as missing, and so does a birth date that is not a calendar day: nothing is guessed. The
 * result carries a code and never a value.
 */
export function requireStats(profile: ProfileStatsRow): RequiredStats {
  const { sex, birth_date, height_cm, activity, onboarding_weight_kg } = profile;
  if (
    sex === null ||
    !isSex(sex) ||
    birth_date === null ||
    !isCalendarDay(birth_date) ||
    height_cm === null ||
    activity === null ||
    !isActivityLevel(activity) ||
    onboarding_weight_kg === null
  ) {
    return { ok: false, reason: "missing_stats" };
  }
  return {
    ok: true,
    stats: { sex, birthDate: birth_date, heightCm: height_cm, activity },
    onboardingWeightKg: onboarding_weight_kg,
  };
}

export type StartSnapshotInput = Readonly<{
  stats: ProfileStats;
  /** The weight entered at set up. The starting estimate is worked out at this weight. */
  onboardingWeightKg: number;
  /** The snapshot's date: today for a new one, the existing date for a rewrite. */
  asOfDate: string;
  /**
   * The trend weight on `asOfDate - 1`, or null when the user has no weigh-in on or before that day
   * (ADR 0003, Amendment 13). The onboarding weight is not a trend, so it is never put here.
   */
  trendWeightKg: number | null;
  /** Replaces the factor of the activity level. It is clamped to the factor band. */
  activityFactor?: number | undefined;
}>;

/** The `expenditure_snapshots` row of a start snapshot, with the database's column names. */
export type StartSnapshot = Readonly<{
  kind: "start";
  as_of_date: string;
  mu_kcal: number;
  var_kcal2: number;
  measurement: null;
  trend_weight_kg: number | null;
  engine_version: EngineParams["version"];
  params: EngineParams;
}>;

/**
 * The start snapshot (ADR 0002, Amendment 2, "The start snapshot and the schedule", point 1): the prior of
 * `initialExpenditure` for the profile's stats at the onboarding weight, with the age on `asOfDate` and
 * no measurement. Pure, and nothing is rounded.
 */
export function startSnapshot(
  { stats, onboardingWeightKg, asOfDate, trendWeightKg, activityFactor }: StartSnapshotInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): StartSnapshot {
  const { muKcal, varKcal2 } = initialExpenditure(
    {
      sex: stats.sex,
      ageYears: ageInYears(stats.birthDate, asOfDate),
      heightCm: stats.heightCm,
      weightKg: onboardingWeightKg,
      activity: stats.activity,
      activityFactor,
    },
    params,
  );
  return {
    kind: "start",
    as_of_date: asOfDate,
    mu_kcal: muKcal,
    var_kcal2: varKcal2,
    measurement: null,
    trend_weight_kg: trendWeightKg,
    engine_version: params.version,
    params,
  };
}

/** The user's newest snapshot, as far as the start snapshot's rule reads it. */
export type LatestSnapshot = Readonly<{
  kind: "start" | "checkin";
  as_of_date: string;
}>;

export type StartSnapshotActionInput = Readonly<{
  /** The user's newest snapshot, or null when there is none. */
  latest: LatestSnapshot | null;
  /** The user's local today, `YYYY-MM-DD`. */
  today: string;
  /** True while the start snapshot is the user's newest snapshot, and not merely while no measurement exists. */
  settling: boolean;
}>;

export type StartSnapshotAction = "new" | "rewrite" | "none";

/**
 * What to do with the start snapshot on a recompute (ADR 0002, Amendment 2, "The start snapshot and the
 * schedule", points 2 to 4):
 *
 * - `new`: the user has no snapshot, or the newest is more than 28 days old. A start snapshot as of today.
 * - `rewrite`: the user is settling, so the start snapshot is rewritten in place (same `as_of_date`) from
 *   the current stats. Never for a `checkin` row, whatever `settling` says, because the writer refuses to
 *   replace one (`start_conflict`).
 * - `none`: the user has been through a check-in, eligible or not, so the learned `mu` is kept.
 */
export function startSnapshotAction({
  latest,
  today,
  settling,
}: StartSnapshotActionInput): StartSnapshotAction {
  if (latest === null) {
    return "new";
  }
  if (addCalendarDays(latest.as_of_date, START_SNAPSHOT_MAX_AGE_DAYS) < today) {
    return "new";
  }
  return settling && latest.kind === "start" ? "rewrite" : "none";
}
