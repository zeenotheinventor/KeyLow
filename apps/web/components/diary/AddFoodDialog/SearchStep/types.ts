import type { FoodSearchHit } from "@keylow/api-client";
import type { Ref } from "react";

export type SearchStepProps = {
  /** What has been typed, untrimmed. The dialog keeps it, so the portion step's Results link finds it again. */
  query: string;
  onQueryChange: (query: string) => void;
  /** The Time field's value, `HH:mm`. */
  time: string;
  /** The time is still the moment the dialog opened. */
  isNow: boolean;
  onTimeChange: (time: string) => void;
  /** Reaches the search field, so the cursor can be put back in it. */
  searchRef?: Ref<HTMLInputElement> | undefined;
  /** A press on a row: go to the portion step for that food. */
  onOpenFood: (foodId: string) => void;
  /** A press on a row's plus: log its serving at once. */
  onAddServing: (hit: FoodSearchHit) => void;
  /** A press on the Quick add row, which the idle search offers: calories and macros by hand. */
  onQuickAdd: () => void;
};
