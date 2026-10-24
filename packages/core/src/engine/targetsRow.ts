import { applyProfileCap } from "./applyProfileCap";
import { deriveTargets } from "./deriveTargets";
import { DEFAULT_ENGINE_PARAMS } from "./params";

import type { CheckinProgram } from "./checkinStep";
import type { EngineParams } from "./params";
import type { CalorieGoal, DayOfWeekKcal } from "./types";
import type { SetupClamp } from "../setup/profileRange";

/** Where a targets row came from: a start snapshot, a weekly check-in or an edit of the program. */
export type TargetsSource = "start" | "checkin" | "recompute";

/** What a targets row's `basis` column holds (ADR 0002, Amendment 2, "Key sets and the 6000 cap"). */
export type TargetsRowBasis<Source extends TargetsSource> = Readonly<{
  source: Source;
  tdeeKcal: number;
  trendWeightKg: number;
  bmrKcal: number;
  goal: CalorieGoal;
  ratePctPerWeek: number;
  /** The true signed rate, negative when the floor lifts a lose target above expenditure. */
  effectiveRatePctPerWeek: number;
  proteinGPerKg: number;
  fatFraction: number;
  dowOffsetsKcal: DayOfWeekKcal;
  /** The engine's clamps and the setup layer's `profile_max`. */
  clamps: readonly SetupClamp[];
}>;

/** The `targets` row of a check-in or a recompute, with the database's column names. */
export type EngineTargetsRow<Source extends TargetsSource> = Readonly<{
  effective_from: string;
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  dow_calories_kcal: DayOfWeekKcal;
  basis: TargetsRowBasis<Source>;
  engine_version: EngineParams["version"];
  params: EngineParams;
}>;

export type TargetsRowInput<Source extends TargetsSource> = Readonly<{
  source: Source;
  /** `YYYY-MM-DD`. The check-in day for a check-in, the user's today for a recompute. */
  effectiveFrom: string;
  /** The expenditure the targets start from: the new mean of a check-in, the newest snapshot's of a recompute. */
  muKcal: number;
  /** The trend weight, or the onboarding weight when the user has no weigh-in. */
  trendWeightKg: number;
  program: CheckinProgram;
  /** Mifflin-St Jeor of the profile's stats, in kilocalories a day. The floor uses it. */
  bmrKcal: number;
}>;

/**
 * The targets row that a check-in and a recompute both write: `deriveTargets` for the program, then the
 * setup layer's 6000 cap through `applyProfileCap`, and the row with its basis (ADR 0002, Amendment 2,
 * "Recompute" and "Key sets and the 6000 cap"). Pure, and nothing is rounded except the targets.
 */
export function targetsRow<Source extends TargetsSource>(
  { source, effectiveFrom, muKcal, trendWeightKg, program, bmrKcal }: TargetsRowInput<Source>,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): EngineTargetsRow<Source> {
  const targetsInput = {
    config: {
      goal: program.goal,
      ratePctPerWeek: program.ratePctPerWeek,
      proteinGPerKg: program.proteinGPerKg,
      fatFraction: program.fatFraction,
      dowOffsetsKcal: program.dowOffsetsKcal,
    },
    tdee: muKcal,
    trendWeight: trendWeightKg,
    bmr: bmrKcal,
  };
  const derived = deriveTargets(targetsInput, params);
  const capped = applyProfileCap(derived, targetsInput, params);

  return {
    effective_from: effectiveFrom,
    calories_kcal: capped.caloriesKcal,
    protein_g: capped.proteinG,
    fat_g: capped.fatG,
    carbs_g: capped.carbsG,
    dow_calories_kcal: derived.dowCaloriesKcal,
    basis: {
      source,
      tdeeKcal: muKcal,
      trendWeightKg,
      bmrKcal,
      goal: program.goal,
      ratePctPerWeek: program.ratePctPerWeek,
      effectiveRatePctPerWeek: capped.effectiveRatePctPerWeek,
      proteinGPerKg: program.proteinGPerKg,
      fatFraction: program.fatFraction,
      dowOffsetsKcal: [...program.dowOffsetsKcal],
      clamps: capped.clamps,
    },
    engine_version: params.version,
    params,
  };
}
