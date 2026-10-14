import type { Food } from "@keylow/core/schemas";

export type MissingValuesReviewProps = {
  foodId: string;
  /** The `quality.fields_missing` keys of the food, such as `protein_g`. */
  fieldsMissing: readonly string[];
  carbsConvention: Food["quality"]["carbs_convention"];
};
