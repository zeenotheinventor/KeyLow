import type { FoodSearchHit } from "@keylow/api-client";
import type { FoodSearchGroup, FoodSearchGroupKey } from "@keylow/core/search";

export type LocalFoodGroupsProps = {
  groups: readonly FoodSearchGroup<FoodSearchHit>[];
  /** The trimmed query, whose words are written in bold in each name. */
  query: string;
  onSeeMore: (key: FoodSearchGroupKey) => void;
  onOpenFood: (foodId: string) => void;
};
