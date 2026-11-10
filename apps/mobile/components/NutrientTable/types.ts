import type { Food } from "@keylow/core/schemas";

export type NutrientTableFood = Pick<
  Food,
  "basis" | "kcal" | "protein_g" | "carbs_g" | "fat_g" | "fibre_g"
>;

export type NutrientTableProps = {
  food: NutrientTableFood;
  /** One sentence under the table, such as the US labelling note. */
  note?: string | undefined;
  /** The label of a food per portion's one portion, "1 bucket", so the heading reads "Nutrition per bucket". */
  portionLabel?: string | undefined;
};
