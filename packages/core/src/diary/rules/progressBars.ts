import { barNumbers } from "../barNumbers";

import type { EntryTotals } from "./sumEntries";

export type ProgressBarKey = "calories" | "protein" | "carbs" | "fat";

export type ProgressBar = {
  key: ProgressBarKey;
  /** What the day has added up to. A total no entry gave a value for reads as 0. */
  eaten: number;
  /** 0 when there is no target. */
  target: number;
  /** How much of the bar is filled, 0 to 1. Over target it is 1. */
  fillFraction: number;
  isOver: boolean;
  /** False for a missing or zero target: the strip then shows the plain value and no bar. */
  hasTarget: boolean;
};

type DayTotals = Pick<EntryTotals, "kcal" | "protein_g" | "carbs_g" | "fat_g">;

/** The profile's targets: each is null when not set, as `ValidTargets` and the profile row have it. */
export type ProgressTargets = {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

const progressBar = (
  key: ProgressBarKey,
  eaten: number | null,
  target: number | null,
): ProgressBar => {
  const eatenAmount = eaten ?? 0;
  const targetAmount = target ?? 0;
  const { fillFraction, isOver } = barNumbers(eatenAmount, targetAmount);

  return {
    key,
    eaten: eatenAmount,
    target: targetAmount,
    fillFraction,
    isOver,
    hasTarget: targetAmount > 0,
  };
};

/**
 * The four compact bars of the diary's progress strip, in the order calories, protein, carbs, fat.
 * The fill and the over flag come from `barNumbers`. Over target a bar is full and `isOver` is set;
 * there is no warning or danger state (brief 17).
 */
export const progressBars = (totals: DayTotals, targets: ProgressTargets): ProgressBar[] => [
  progressBar("calories", totals.kcal, targets.kcal),
  progressBar("protein", totals.protein_g, targets.protein_g),
  progressBar("carbs", totals.carbs_g, targets.carbs_g),
  progressBar("fat", totals.fat_g, targets.fat_g),
];
