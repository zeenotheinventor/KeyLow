import type { FoodSearchHit } from "@keylow/api-client";
import type { FoodSearchGroupKey } from "@keylow/core/search";
import type { ReactNode } from "react";

export type SearchResultsProps = {
  /** What the user has typed, untrimmed. */
  query: string;
  onOpenFood: (foodId: string) => void;
  /** Offers to create a food when nothing is found. Leave it out where creating one would leave the screen, such as a recipe's ingredient search. */
  onCreateFood?: (() => void) | undefined;
  /** Takes the place of the "Search for a food" state before anything is typed, such as Quick add and Recent. */
  idleContent?: ReactNode;
  /** Draws the local rows as servings with a plus that logs one at once, as the log search does. */
  logRows?: LogRows | undefined;
  /**
   * Draws the local rows as servings that all open the amount step, with a chevron and no plus, as the ingredient
   * search does. The live Open Food Facts rows stay per 100 g.
   */
  choosesAmount?: boolean | undefined;
};

export type LogRows = {
  /** Dims every plus and stops it responding, such as while offline. */
  addDisabled: boolean;
  onAdd: (food: FoodSearchHit) => void;
};

/** The groups the user has opened with "See N more", and the query they were opened for. */
export type Expansion = { query: string; groups: readonly FoodSearchGroupKey[] };
