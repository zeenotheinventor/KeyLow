import { DEFAULT_ENGINE_PARAMS } from "../engine";

import type { MeasurementCounts, MeasurementReason } from "../engine";
import type { ProgramSnapshot, ProgramTargets } from "./types";
import type { SetupClamp } from "../setup/profileRange";

/** What kind of change the summary describes. */
export type CheckinSummaryKind = "measured" | "not_measured" | "start" | "recompute";

/**
 * What changed at a check-in and why, as codes and numbers. It holds no words: the screens write the
 * copy from these.
 */
export type CheckinSummary = Readonly<{
  kind: CheckinSummaryKind;
  /** Why the window did not measure, in the order the rules are checked. Empty unless `not_measured`. */
  reasons: readonly MeasurementReason[];
  /** The days the window held, as stored. All 0 for `start` and `recompute`. */
  counts: MeasurementCounts;
  /** The step the expenditure took, in kilocalories a day (signed). 0 when nothing was measured. */
  expenditureChangeKcal: number;
  /** The step before the weekly clamp, in kilocalories a day (signed). 0 when nothing was measured. */
  expenditureRawChangeKcal: number;
  /** True when the weekly clamp cut the step, so the raw step was larger than the one taken. */
  expenditureStepClamped: boolean;
  /** True when the check-in left the belief less certain than the one before it. */
  varianceGrew: boolean;
  /** The calories now less the calories before (signed). Null when there are no earlier targets. */
  caloriesChangeKcal: number | null;
  /** The guardrails that changed the target, in the order recorded. */
  clamps: readonly SetupClamp[];
  /** The rate the target implies, in percent of body weight a week. Signed, as stored. */
  effectiveRatePctPerWeek: number;
  /** True when the target moves against the goal (the floor is above expenditure for a `lose` goal). */
  belowGoalDirection: boolean;
}>;

/** The part of the summary that the snapshot's measurement decides. */
type MeasurementReading = Pick<
  CheckinSummary,
  | "kind"
  | "reasons"
  | "counts"
  | "expenditureChangeKcal"
  | "expenditureRawChangeKcal"
  | "expenditureStepClamped"
  | "varianceGrew"
>;

const NOTHING_MEASURED: Omit<MeasurementReading, "kind"> = {
  reasons: [],
  counts: { spanDays: 0, weighDays: 0, completeDays: 0 },
  expenditureChangeKcal: 0,
  expenditureRawChangeKcal: 0,
  expenditureStepClamped: false,
  varianceGrew: false,
};

/**
 * Every code of `SetupClamp`. A `Record` over the type, so a code added to the engine's `Clamp` or to the
 * setup layer's list is a type error here until it is listed, and not a code that is dropped without notice.
 */
const KNOWN_CLAMPS: Record<SetupClamp, true> = {
  max_rate: true,
  max_deficit: true,
  max_surplus: true,
  floor: true,
  macro_fit: true,
  dow_floor: true,
  dow_range: true,
  profile_max: true,
};

const isKnownClamp = (code: string): code is SetupClamp => Object.hasOwn(KNOWN_CLAMPS, code);

/**
 * Whether a measured week left the belief less certain than the one before it. The snapshot holds the
 * variance after the step, `var' = (1 - K) * P`, and the gain `K`, so the drifted prior is
 * `P = var' / (1 - K)` and the prior variance is `P - processSd^2`. A week with a very large measurement
 * variance has a small `K` and can end above the prior variance. The process step is the engine's
 * default, as the snapshot as read carries no params.
 */
function measuredVarianceGrew(varKcal2: number, gain: number): boolean {
  const driftedVarKcal2 = varKcal2 / (1 - gain);
  const priorVarKcal2 =
    driftedVarKcal2 - DEFAULT_ENGINE_PARAMS.expenditure.processSdKcalPerWeek ** 2;
  return varKcal2 > priorVarKcal2;
}

function readMeasurement(snapshot: ProgramSnapshot): MeasurementReading {
  const { measurement } = snapshot;
  if (measurement === null) {
    return { kind: "start", ...NOTHING_MEASURED };
  }
  const counts = {
    spanDays: measurement.spanDays,
    weighDays: measurement.weighDays,
    completeDays: measurement.completeDays,
  };
  if (!measurement.eligible) {
    return {
      kind: "not_measured",
      reasons: measurement.reasons,
      counts,
      expenditureChangeKcal: 0,
      expenditureRawChangeKcal: 0,
      expenditureStepClamped: false,
      varianceGrew: true,
    };
  }
  return {
    kind: "measured",
    reasons: [],
    counts,
    expenditureChangeKcal: measurement.stepKcal,
    expenditureRawChangeKcal: measurement.rawStepKcal,
    expenditureStepClamped: measurement.stepClamped,
    varianceGrew: measuredVarianceGrew(snapshot.varKcal2, measurement.gain),
  };
}

/**
 * The check-in summary, for the newest targets, the targets before them (null when there are none) and
 * the newest snapshot. A recompute (`basis.source` of `recompute`) changed the targets only, so it carries
 * no measurement of the snapshot. A `start` snapshot has none either. Otherwise the snapshot says whether
 * the week measured. `varianceGrew` is true for a week that did not measure (the belief gets only the
 * process step) and, for a measured week, when the variance after the step is above the one before. A clamp code this build does not know is left out, so a screen only ever sees codes
 * of the closed list.
 */
export function checkinSummary(
  previousTargets: ProgramTargets | null,
  targets: ProgramTargets,
  snapshot: ProgramSnapshot,
): CheckinSummary {
  const { basis } = targets;
  const reading: MeasurementReading =
    basis.source === "recompute"
      ? { kind: "recompute", ...NOTHING_MEASURED }
      : readMeasurement(snapshot);
  return {
    ...reading,
    caloriesChangeKcal:
      previousTargets === null ? null : targets.caloriesKcal - previousTargets.caloriesKcal,
    clamps: basis.clamps.filter(isKnownClamp),
    effectiveRatePctPerWeek: basis.effectiveRatePctPerWeek,
    belowGoalDirection: basis.effectiveRatePctPerWeek < 0,
  };
}
