import type { EntryTotals } from "@keylow/core/diary";

export type NutritionCardTargets = {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

export type NutritionCardProps = {
  /** What the day has added up to, from core's `sumEntries`. */
  totals: EntryTotals;
  /** The profile's targets, each null when not set. */
  targets: NutritionCardTargets;
  /** The card, apart from its footer, opens the Diary for today. */
  onOpenDiary: () => void;
  /** The footer's Edit opens Targets. */
  onEditTargets: () => void;
};
