import { barNumbers } from "../barNumbers";

import type { EntryTotals } from "./sumEntries";

export type ProgressBarKey = "calories" | "protein" | "carbs" | "fat";

export type ProgressBar = {
  key: ProgressBarKey;
  /** What the day has added up to. A total no entry gave a value for reads as 0. */
  eaten: number;
  /** 0 when there is no target. */
  target: number;
  /** What the plate holds of this nutrient, 0 when there is no plate. It is never part of `eaten`. */
  plate: number;
  /** How much of the bar the eaten amount fills, 0 to 1. Over target it is 1. */
  fillFraction: number;
  /** The plate's part of the track, right after the eaten fill: eaten plus plate never passes 1. */
  plateFillFraction: number;
  /** Decided on eaten plus the plate. */
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

const noPlate: DayTotals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

const progressBar = (
  key: ProgressBarKey,
  eaten: number | null,
  target: number | null,
  plate: number | null,
): ProgressBar => {
  const eatenAmount = eaten ?? 0;
  const plateAmount = plate ?? 0;
  const targetAmount = target ?? 0;
  const { fillFraction } = barNumbers(eatenAmount, targetAmount);
  const withPlate = barNumbers(eatenAmount + plateAmount, targetAmount);

  return {
    key,
    eaten: eatenAmount,
    target: targetAmount,
    plate: plateAmount,
    fillFraction,
    plateFillFraction: withPlate.fillFraction - fillFraction,
    isOver: withPlate.isOver,
    hasTarget: targetAmount > 0,
  };
};

/**
 * The four compact bars of the diary's progress strip, in the order calories, protein, carbs, fat.
 * The fill and the over flag come from `barNumbers`. Over target a bar is full and `isOver` is set;
 * there is no warning or danger state (brief 17).
 *
 * The optional third argument is what the plate holds. Each bar then carries it as `plate`, draws its
 * share of the track after the eaten fill, and is over when eaten plus the plate passes the target.
 * Without it every bar is exactly the day's.
 */
export const progressBars = (
  totals: DayTotals,
  targets: ProgressTargets,
  plate: DayTotals = noPlate,
): ProgressBar[] => [
  progressBar("calories", totals.kcal, targets.kcal, plate.kcal),
  progressBar("protein", totals.protein_g, targets.protein_g, plate.protein_g),
  progressBar("carbs", totals.carbs_g, targets.carbs_g, plate.carbs_g),
  progressBar("fat", totals.fat_g, targets.fat_g, plate.fat_g),
];
