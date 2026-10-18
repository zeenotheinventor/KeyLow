import type { TrainingParams } from "./params";
import type { WorkoutSetRow } from "../schemas/training";

export type EffortSet = Pick<WorkoutSetRow, "set_type" | "rir" | "rpe">;

/**
 * How much one set counts towards fatigue and weekly volume, from 0 to 1 (ADR 0005, "The heat model").
 * A warm-up counts nothing. Any other set (working, drop or failure) is read from its RIR, or its RPE
 * when it has no RIR, and counts in full when it has neither. A set never has both: the row schema
 * refuses that, and RIR is read first if one ever does.
 */
export const setEffort = (set: EffortSet, params: TrainingParams): number => {
  const { effort } = params;
  if (set.set_type === "warmup") {
    return effort.warmup;
  }
  if (set.rir !== null) {
    if (set.rir <= effort.hardMaxRir) {
      return effort.hard;
    }
    return set.rir <= effort.moderateMaxRir ? effort.moderate : effort.easy;
  }
  if (set.rpe !== null) {
    if (set.rpe >= effort.hardMinRpe) {
      return effort.hard;
    }
    return set.rpe >= effort.moderateMinRpe ? effort.moderate : effort.easy;
  }
  return effort.unknown;
};
