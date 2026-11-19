import { dayNumber } from "../../dates/calendarDay";
import { TOLERANCE_EPSILON, toleranceOf } from "../../recipes/fit/judgeTargets";

import type { Measure } from "./types";
import type { AchievementStats, DayStats } from "../stats";

type DayTargets = AchievementStats["manualTargets"];

/**
 * The targets that judge a day: the engine row in force that day (the latest one that started on or before
 * it), else the person's own targets.
 */
export const targetsInForce = (stats: AchievementStats, localDate: string): DayTargets => {
  const row = stats.engineTargetsRows
    .filter((candidate) => candidate.effectiveFrom <= localDate)
    .reduce<AchievementStats["engineTargetsRows"][number] | undefined>(
      (latest, candidate) =>
        latest === undefined || candidate.effectiveFrom > latest.effectiveFrom ? candidate : latest,
      undefined,
    );
  return row ?? stats.manualTargets;
};

const isWithinTolerance = (
  nutrient: "kcal" | "carbs_g" | "fat_g",
  actual: number,
  target: number | null,
): boolean =>
  target !== null && Math.abs(actual - target) <= toleranceOf(nutrient, target) + TOLERANCE_EPSILON;

/** Protein counts at or above the target, so going over is fine. Under it never counts. */
const isProteinReached = (actual: number, target: number | null): boolean =>
  target !== null && actual + TOLERANCE_EPSILON >= target;

type DayJudgement = Readonly<{
  calories: boolean;
  protein: boolean;
  carbs: boolean;
  fat: boolean;
}>;

/** How a complete day sits against its targets. An incomplete day, or one with no targets, never counts. */
export const judgeDay = (stats: AchievementStats, day: DayStats): DayJudgement => {
  const targets = day.isComplete ? targetsInForce(stats, day.localDate) : null;
  return {
    calories: targets !== null && isWithinTolerance("kcal", day.kcal, targets.kcal),
    protein: targets !== null && isProteinReached(day.proteinG, targets.proteinG),
    carbs: targets !== null && isWithinTolerance("carbs_g", day.carbsG, targets.carbsG),
    fat: targets !== null && isWithinTolerance("fat_g", day.fatG, targets.fatG),
  };
};

export const proteinDays: Measure = ({ stats }) =>
  stats.days.filter((day) => judgeDay(stats, day).protein).length;

export const calorieDays: Measure = ({ stats }) =>
  stats.days.filter((day) => judgeDay(stats, day).calories).length;

export const balancedDays: Measure = ({ stats }) =>
  stats.days.filter((day) => {
    const judgement = judgeDay(stats, day);
    return judgement.calories && judgement.protein && judgement.carbs && judgement.fat;
  }).length;

/** The longest run of consecutive calendar days with calories and protein both on target. */
export const perfectWeekRun: Measure = ({ stats }) => {
  const dayNumbers = stats.days
    .filter((day) => {
      const judgement = judgeDay(stats, day);
      return judgement.calories && judgement.protein;
    })
    .map((day) => dayNumber(day.localDate))
    .sort((first, second) => first - second);
  let longest = 0;
  let run = 0;
  let previous: number | undefined;
  for (const current of dayNumbers) {
    if (current === previous) {
      continue;
    }
    run = previous !== undefined && current === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = current;
  }
  return longest;
};
