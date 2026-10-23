import { DEFAULT_ENGINE_PARAMS } from "./params";

import type { EngineParams } from "./params";
import type { CalorieGoal, Clamp } from "./types";

export type CalorieTargetInput = Readonly<{
  goal: CalorieGoal;
  /** The wanted rate in percent of body weight a week. It is ignored for `maintain`. */
  ratePctPerWeek: number;
  /** Daily energy expenditure, in kilocalories. */
  tdee: number;
  /** The trend weight, in kilograms. */
  trendWeight: number;
  /** Basal metabolic rate, in kilocalories a day. */
  bmr: number;
}>;

export type CalorieTarget = Readonly<{
  /** A multiple of `roundToKcal`, inside every guardrail. */
  caloriesKcal: number;
  /** The guardrails that changed the unrounded target, in the order they were applied. */
  clamps: readonly Clamp[];
  /**
   * The rate the final calories imply, in percent of body weight a week. True and signed: positive
   * means movement in the goal's direction, so it is negative when the floor lifts a lose target above tdee.
   */
  effectiveRatePctPerWeek: number;
}>;

const DAYS_PER_WEEK = 7;

/**
 * The calorie half of `deriveTargets`, as the Build Plan's Targets section and ADR 0002, Amendment 1
 * specify it. The 6000 profile maximum is the setup layer's.
 */
export function deriveCalorieTarget(
  { goal, ratePctPerWeek, tdee, trendWeight, bmr }: CalorieTargetInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): CalorieTarget {
  const { targets, expenditure } = params;
  const clamps: Clamp[] = [];
  const dailyKcalPerPercentPerWeek =
    (trendWeight * expenditure.energyDensityKcalPerKg) / DAYS_PER_WEEK / 100;

  const lowestKcal = tdee * (1 - targets.maxDeficitFrac);
  const floorKcal = Math.max(targets.floorAbsKcal, targets.floorBmrFactor * bmr);
  const highestKcal = tdee * (1 + targets.maxSurplusFrac);

  let rawKcal = tdee;
  if (goal === "lose") {
    if (ratePctPerWeek > targets.maxLossPct) clamps.push("max_rate");
    rawKcal = tdee - Math.min(ratePctPerWeek, targets.maxLossPct) * dailyKcalPerPercentPerWeek;
    if (rawKcal < lowestKcal) {
      rawKcal = lowestKcal;
      clamps.push("max_deficit");
    }
    if (rawKcal < floorKcal) {
      rawKcal = floorKcal;
      clamps.push("floor");
    }
  } else if (goal === "gain") {
    if (ratePctPerWeek > targets.maxGainPct) clamps.push("max_rate");
    rawKcal = tdee + Math.min(ratePctPerWeek, targets.maxGainPct) * dailyKcalPerPercentPerWeek;
    if (rawKcal > highestKcal) {
      rawKcal = highestKcal;
      clamps.push("max_surplus");
    }
  }

  // Rounding to the nearest step can cross a bound that is not a multiple of the step, so step back inside it.
  const step = targets.roundToKcal;
  let caloriesKcal = Math.round(rawKcal / step) * step;
  if (goal === "lose") {
    caloriesKcal = Math.max(caloriesKcal, Math.ceil(Math.max(lowestKcal, floorKcal) / step) * step);
  } else if (goal === "gain") {
    caloriesKcal = Math.min(caloriesKcal, Math.floor(highestKcal / step) * step);
  }

  const movedKcal = goal === "lose" ? tdee - caloriesKcal : caloriesKcal - tdee;
  const effectiveRatePctPerWeek = goal === "maintain" ? 0 : movedKcal / dailyKcalPerPercentPerWeek;

  return { caloriesKcal, clamps, effectiveRatePctPerWeek };
}

const KCAL_PER_GRAM_OF_PROTEIN_OR_CARBS = 4;
const KCAL_PER_GRAM_OF_FAT = 9;

export type MacroSplitInput = Readonly<{
  /** The day's calories, in kilocalories. */
  caloriesKcal: number;
  /** The trend weight, in kilograms. */
  trendWeight: number;
  /** The wanted protein, in grams for each kilogram of trend weight. It is capped by the params. */
  proteinGPerKg: number;
  /** The share of the calories left after protein that goes to fat. */
  fatFraction: number;
}>;

export type MacroSplit = Readonly<{
  /** Whole grams. */
  proteinG: number;
  /** Whole grams. */
  fatG: number;
  /** Whole grams. */
  carbsG: number;
  /** `macro_fit` when protein had to give way to the fat floor, otherwise empty. */
  clamps: readonly Clamp[];
}>;

/**
 * Splits calories into grams of protein, fat and carbs, protein first. Fat takes its fraction of what
 * protein leaves, never less than the fat floor, and carbs fill the rest. When protein and the fat floor
 * together do not fit, the fat floor wins (ADR 0002, Amendment 1): protein is cut to what fits, carbs are
 * 0 and `macro_fit` is recorded. When the fat floor alone is over the calories, fat is the whole grams
 * that fit, protein and carbs are 0 and `macro_fit` is recorded.
 */
export function splitMacros(
  { caloriesKcal, trendWeight, proteinGPerKg, fatFraction }: MacroSplitInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): MacroSplit {
  const { proteinMaxGPerKg, fatMinGPerKg } = params.targets;

  const wantedProteinG = Math.round(Math.min(proteinGPerKg, proteinMaxGPerKg) * trendWeight);
  const fatFloorG = Math.round(fatMinGPerKg * trendWeight);

  if (KCAL_PER_GRAM_OF_FAT * fatFloorG > caloriesKcal) {
    const fatG = Math.floor(caloriesKcal / KCAL_PER_GRAM_OF_FAT);
    return { proteinG: 0, fatG, carbsG: 0, clamps: ["macro_fit"] };
  }

  if (
    KCAL_PER_GRAM_OF_PROTEIN_OR_CARBS * wantedProteinG + KCAL_PER_GRAM_OF_FAT * fatFloorG >
    caloriesKcal
  ) {
    const proteinG = Math.floor(
      (caloriesKcal - KCAL_PER_GRAM_OF_FAT * fatFloorG) / KCAL_PER_GRAM_OF_PROTEIN_OR_CARBS,
    );
    return { proteinG, fatG: fatFloorG, carbsG: 0, clamps: ["macro_fit"] };
  }

  const afterProteinKcal = caloriesKcal - KCAL_PER_GRAM_OF_PROTEIN_OR_CARBS * wantedProteinG;
  const fatG = Math.max(
    Math.round((fatFraction * afterProteinKcal) / KCAL_PER_GRAM_OF_FAT),
    fatFloorG,
  );
  const carbsG = Math.round(
    (afterProteinKcal - KCAL_PER_GRAM_OF_FAT * fatG) / KCAL_PER_GRAM_OF_PROTEIN_OR_CARBS,
  );

  return { proteinG: wantedProteinG, fatG, carbsG, clamps: [] };
}

export type DeriveTargetsConfig = Readonly<{
  goal: CalorieGoal;
  /** The wanted rate in percent of body weight a week. It is ignored for `maintain`. */
  ratePctPerWeek: number;
  /** The wanted protein, in grams for each kilogram of trend weight. */
  proteinGPerKg: number;
  /** The share of the calories left after protein that goes to fat. */
  fatFraction: number;
}>;

export type DeriveTargetsInput = Readonly<{
  config: DeriveTargetsConfig;
  /** Daily energy expenditure, in kilocalories. */
  tdee: number;
  /** The trend weight, in kilograms. */
  trendWeight: number;
  /** Basal metabolic rate, in kilocalories a day. */
  bmr: number;
}>;

export type DerivedTargets = Readonly<{
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** The calorie clamps in the order they were applied, then `macro_fit`. */
  clamps: readonly Clamp[];
  effectiveRatePctPerWeek: number;
  engineVersion: EngineParams["version"];
}>;

/**
 * The daily targets: calories from `deriveCalorieTarget`, then the macros from `splitMacros`. The day of
 * week offsets are not here yet.
 */
export function deriveTargets(
  { config, tdee, trendWeight, bmr }: DeriveTargetsInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): DerivedTargets {
  const { goal, ratePctPerWeek, proteinGPerKg, fatFraction } = config;
  const calorieTarget = deriveCalorieTarget(
    { goal, ratePctPerWeek, tdee, trendWeight, bmr },
    params,
  );
  const macros = splitMacros(
    { caloriesKcal: calorieTarget.caloriesKcal, trendWeight, proteinGPerKg, fatFraction },
    params,
  );

  return {
    caloriesKcal: calorieTarget.caloriesKcal,
    proteinG: macros.proteinG,
    fatG: macros.fatG,
    carbsG: macros.carbsG,
    clamps: [...calorieTarget.clamps, ...macros.clamps],
    effectiveRatePctPerWeek: calorieTarget.effectiveRatePctPerWeek,
    engineVersion: params.version,
  };
}
