import type { NutrientRow } from "@keylow/core/copy";

export type WeekAverageTableProps = {
  /** Heads the table and names it, such as "Daily average". */
  heading: string;
  /** The rows, from core's `weekAverageRows`. */
  rows: readonly NutrientRow[];
};
