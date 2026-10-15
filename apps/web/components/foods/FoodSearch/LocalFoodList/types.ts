import type { Food } from "@keylow/core/schemas";
import type { FoodSearchGroup, FoodSearchGroupKey } from "@keylow/core/search";

/** What a row needs: a search hit and a whole food both have it. */
export type LocalFood = Pick<
  Food,
  "id" | "source" | "name" | "brand" | "basis" | "kcal" | "protein_g" | "fat_g" | "carbs_g"
>;

export type LocalFoodListProps = {
  groups: FoodSearchGroup<LocalFood>[];
  /** The text searched for, whose words are written in bold in each name. */
  query: string;
  /** Called with the group when its "See N more" is pressed. Without it no group offers more. */
  onSeeMore?: (key: FoodSearchGroupKey) => void;
};
