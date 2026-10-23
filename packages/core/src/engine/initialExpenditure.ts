import { DEFAULT_ENGINE_PARAMS } from "./params";

import type { EngineParams } from "./params";
import type { ActivityLevel, Sex } from "./types";

export type BmrInput = Readonly<{
  sex: Sex;
  /** Completed years. The caller works it out from the birth date. */
  ageYears: number;
  heightCm: number;
  weightKg: number;
}>;

export type InitialExpenditureInput = BmrInput &
  Readonly<{
    activity: ActivityLevel;
    /** Replaces the factor of `activity`. It is clamped to the factor band. */
    activityFactor?: number | undefined;
  }>;

/** The engine's starting state for daily energy expenditure. Nothing is rounded. */
export type InitialExpenditure = Readonly<{
  bmrKcal: number;
  /** The mean of the prior, in kilocalories a day. */
  muKcal: number;
  /** The variance of the prior, in kilocalories squared. */
  varKcal2: number;
  /** The factor actually used: the level's own, or the override after clamping. */
  activityFactor: number;
}>;

function clamp(value: number, range: Readonly<{ min: number; max: number }>): number {
  return Math.min(Math.max(value, range.min), range.max);
}

/** The Mifflin-St Jeor equation: 10 per kg, 6.25 per cm, minus 5 per year, plus the offset of the sex. */
export function bmrMifflinStJeor(
  { sex, ageYears, heightCm, weightKg }: BmrInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + params.expenditure.sexOffsetKcal[sex];
}

/** The prior the adaptive engine starts from: `mu` is BMR times an activity factor, `var` is `(priorCv * mu)^2`. */
export function initialExpenditure(
  { activity, activityFactor, ...bmrInput }: InitialExpenditureInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): InitialExpenditure {
  const { expenditure } = params;
  const bmrKcal = bmrMifflinStJeor(bmrInput, params);
  const factorUsed =
    activityFactor === undefined
      ? expenditure.activityFactors[activity]
      : clamp(activityFactor, expenditure.activityFactorBand);
  const muKcal = clamp(bmrKcal * factorUsed, expenditure.zClampKcal);

  return {
    bmrKcal,
    muKcal,
    varKcal2: (expenditure.priorCv * muKcal) ** 2,
    activityFactor: factorUsed,
  };
}
