import type { RecipeSummary } from "@keylow/api-client";

export type RecipeLogGroupProps = {
  /** The recipes to offer, in the order to show them. Each can be logged: see `canLogRecipe` in core. */
  recipes: readonly RecipeSummary[];
  /** What was typed, whose matched letters are written semibold in each name. */
  query: string;
  /** Dims the plus and stops it responding, such as while the plate is being logged. */
  addDisabled: boolean;
  /** A press on a row: go to the amount step for that recipe. */
  onOpen: (recipe: RecipeSummary) => void;
  /** A press on a row's plus: put one serving of that recipe on the plate. */
  onAdd: (recipe: RecipeSummary) => void;
};
