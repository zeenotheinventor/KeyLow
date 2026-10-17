import type { LogRecipes } from "../SearchResults";

export type RecipeLogGroupProps = {
  /** The recipes that can be logged, in the order the search returned them. */
  recipes: LogRecipes["rows"];
  /** The trimmed query, whose words are written in bold in each name. */
  query: string;
  /** Dims every plus and stops it responding, such as while offline. */
  addDisabled: boolean;
  onAdd: LogRecipes["onAdd"];
  onOpen: LogRecipes["onOpen"];
};
