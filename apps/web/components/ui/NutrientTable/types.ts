export type NutrientRow = {
  label: string;
  /** The value with its unit, such as "32 g". Null when the source does not give it. */
  value: string | null;
};

export type NutrientTableProps = {
  /** Names the table and heads it, such as "Nutrition per 100 g". */
  caption: string;
  rows: readonly NutrientRow[];
  className?: string;
};
