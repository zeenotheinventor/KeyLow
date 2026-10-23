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
 * specify it. The 6000 profile maximum is the setup layer's, and the macros come with the next ticket.
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
