import type { Food, FoodPortion } from "@keylow/core/schemas";

export type FoodDetailProps = {
  food: Food;
  portions: FoodPortion[];
  /** Opens the editor. Only offered for the user's own foods. */
  onEdit: () => void;
  /** Opens the copy form, to save a copy of a food with missing values as the user's own. Only offered for those foods. */
  onCopy: () => void;
};
