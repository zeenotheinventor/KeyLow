import type { LogRows } from "../SearchResults";
import type { FoodSearchHit } from "@keylow/api-client";
import type { FoodSearchGroup, FoodSearchGroupKey } from "@keylow/core/search";

export type LocalFoodGroupsProps = {
  groups: readonly FoodSearchGroup<FoodSearchHit>[];
  /** The trimmed query, whose words are written in bold in each name. */
  query: string;
  /** Draws each row as a serving with a plus, as the log search does, whose plus puts it on the plate. */
  logRows?: LogRows | undefined;
  /** Draws each row as a serving that opens the amount step, with a chevron and no plus, as the ingredient search does. */
  choosesAmount?: boolean | undefined;
  onSeeMore: (key: FoodSearchGroupKey) => void;
  onOpenFood: (foodId: string) => void;
};
