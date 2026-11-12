import type { Food } from "@keylow/core/schemas";

export type MissingValuesReviewProps = {
  foodId: string;
  /** The `quality.fields_missing` keys of the food, such as `protein_g`. */
  fieldsMissing: readonly string[];
  /** False for a food that cannot be copied into the user's own foods: the notice then has no action. */
  canCopy: boolean;
  carbsConvention: Food["quality"]["carbs_convention"];
};
