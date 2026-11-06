import type { BarcodeButton } from "@/components/ui/SearchField";
import type { FoodSearchHit, RecentFood, RecipeSummary } from "@keylow/api-client";
import type { ReactNode, Ref } from "react";

type CommonSearchStepProps = {
  /** What has been typed, untrimmed. The dialog keeps it, so the portion step's Results link finds it again. */
  query: string;
  onQueryChange: (query: string) => void;
  /** Reaches the search field, so the cursor can be put back in it. */
  searchRef?: Ref<HTMLInputElement> | undefined;
  /** A press on a row: go to the portion step for that food. */
  onOpenFood: (foodId: string) => void;
  /** A press on a Recent row: go to the amount step at the amount it was last logged with. */
  onOpenRecent: (food: RecentFood) => void;
};

/** The diary's search: foods found go on the plate, and each row has a plus that puts its serving there. */
export type LogSearchStepProps = CommonSearchStepProps & {
  mode?: "log" | undefined;
  /** The Time field's value, `HH:mm`: the plate's time. */
  time: string;
  /** The time is still Now. */
  isNow: boolean;
  onTimeChange: (time: string) => void;
  /** Dims the pluses and the Time field and stops them responding, while the plate is being logged. */
  isLogging: boolean;
  /** A press on a row's plus: put its serving on the plate. */
  onAddServing: (hit: FoodSearchHit) => void;
  /** A press on a recipe row: go to the amount step for that recipe. */
  onOpenRecipe: (recipe: RecipeSummary) => void;
  /** A press on a recipe row's plus: put one serving of it on the plate. */
  onAddRecipeServing: (recipe: RecipeSummary) => void;
  /** A press on a Recent row's plus: put the amount it was last logged with on the plate. */
  onAddRecent: (food: RecentFood) => void;
  /** A press on the Quick add row, which the idle search offers: calories and macros by hand. */
  onQuickAdd: () => void;
};

/**
 * A recipe's ingredient search: no Time field, no plus and no Quick add row, because an ingredient is
 * not logged and its amount matters, so every row ends in a chevron and opens the amount step. Its idle
 * search is Recent alone, as the phone's is.
 */
type IngredientSearchStepProps = CommonSearchStepProps & {
  mode: "ingredient";
  /** The search field's barcode button, which the owner of the typed lookup panel supplies. */
  barcodeButton?: BarcodeButton | undefined;
  /** What sits between the field and the results: the typed barcode lookup panel, or the note that it is off. */
  barcodePanel?: ReactNode;
};

export type SearchStepProps = LogSearchStepProps | IngredientSearchStepProps;
