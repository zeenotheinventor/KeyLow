import type { Food } from "@keylow/core/schemas";
import type { FoodSearchGroup, FoodSearchGroupKey } from "@keylow/core/search";

export type LocalFoodListProps = {
  groups: FoodSearchGroup<Food>[];
  /** The text searched for, whose words are written in bold in each name. */
  query: string;
  /** Called with the group when its "See N more" is pressed. Without it no group offers more. */
  onSeeMore?: (key: FoodSearchGroupKey) => void;
};
