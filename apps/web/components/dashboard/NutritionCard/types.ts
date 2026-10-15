import type { EntryTotals } from "@keylow/core/diary";

export type NutritionCardProps = {
  /** What the day has added up to, from core's `sumEntries`. */
  totals: EntryTotals;
  /** The profile's targets, each null when not set. */
  targets: {
    kcal: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  };
};
