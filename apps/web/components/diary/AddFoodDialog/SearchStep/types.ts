import type { FoodSearchHit } from "@keylow/api-client";
import type { Ref } from "react";

type CommonSearchStepProps = {
  /** What has been typed, untrimmed. The dialog keeps it, so the portion step's Results link finds it again. */
  query: string;
  onQueryChange: (query: string) => void;
  /** Reaches the search field, so the cursor can be put back in it. */
  searchRef?: Ref<HTMLInputElement> | undefined;
  /** A press on a row: go to the portion step for that food. */
  onOpenFood: (foodId: string) => void;
};

/** The diary's search: foods found are logged at a time, and each row has a plus that logs its serving at once. */
type LogSearchStepProps = CommonSearchStepProps & {
  mode?: "log" | undefined;
  /** The Time field's value, `HH:mm`. */
  time: string;
  /** The time is still the moment the dialog opened. */
  isNow: boolean;
  onTimeChange: (time: string) => void;
  /** A press on a row's plus: log its serving at once. */
  onAddServing: (hit: FoodSearchHit) => void;
  /** A press on the Quick add row, which the idle search offers: calories and macros by hand. */
  onQuickAdd: () => void;
};

/**
 * A recipe's ingredient search: no Time field, no plus and no Quick add row, because an ingredient is
 * not logged and its amount matters, so every row ends in a chevron and opens the amount step.
 */
type IngredientSearchStepProps = CommonSearchStepProps & { mode: "ingredient" };

export type SearchStepProps = LogSearchStepProps | IngredientSearchStepProps;
