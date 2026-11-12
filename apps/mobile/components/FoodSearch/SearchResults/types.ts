import type { FoodSearchHit, RecipeSummary } from "@keylow/api-client";
import type { ReactNode } from "react";

export type SearchResultsProps = {
  /** What the user has typed, untrimmed. */
  query: string;
  /** How many food rows to draw, across Your foods, Common foods and Branded foods in that order. The recipes and Open Food Facts products are not counted. */
  visibleRowCount: number;
  /** Says whether food rows are left to reveal, once the results are in, so the list reveals more only when there is something to show. */
  onMoreRowsChange: (hasMoreRows: boolean) => void;
  onOpenFood: (foodId: string) => void;
  /** Offers to create a food when nothing is found. Leave it out where creating one would leave the screen, such as a recipe's ingredient search. */
  onCreateFood?: (() => void) | undefined;
  /** Takes the place of the "Search for a food" state before anything is typed, such as Quick add and Recent. */
  idleContent?: ReactNode;
  /** Draws the local rows as servings with a plus that puts one on the plate, as the log search does. */
  logRows?: LogRows | undefined;
  /**
   * Draws the local rows as servings that all open the amount step, with a chevron and no plus, as the ingredient
   * search does. The live Open Food Facts rows stay per 100 g.
   */
  choosesAmount?: boolean | undefined;
};

/**
 * The user's recipes that match, drawn as the first group of the log search. A row opens the amount step, and its
 * plus puts one serving on the plate.
 */
export type LogRecipes = {
  /** The recipes that can be logged, in the order the search returned them. */
  rows: readonly RecipeSummary[];
  /** True while the recipes on show may not be the answer yet, so "No foods found" is not said. */
  isSearching: boolean;
  onAdd: (recipe: RecipeSummary) => void;
  /** Opens the amount step for the recipe. */
  onOpen: (recipe: RecipeSummary) => void;
};

export type LogRows = {
  /** Dims every plus and stops it responding, such as while the plate is being logged. */
  addDisabled: boolean;
  onAdd: (food: FoodSearchHit) => void;
  /** Leave it out for a log search that offers no recipes. */
  recipes?: LogRecipes | undefined;
};
