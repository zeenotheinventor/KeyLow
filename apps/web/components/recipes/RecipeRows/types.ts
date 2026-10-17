import type { RecipeSummary } from "@keylow/api-client";
import type { ReactNode, RefCallback } from "react";

/** Which of the two drawings of the rows a button is in: the table's, or the narrow list's cards. */
export type RecipeRowLayout = "table" | "card";

/** What a row gives the buttons it holds. */
export type RecipeRowButtons = {
  layout: RecipeRowLayout;
  /**
   * Put this on the button that takes the row out of the list, such as Archive. Pressing it can then
   * hand focus to the next row's one.
   */
  removeButtonRef: RefCallback<HTMLButtonElement>;
  /**
   * Call it as the row's remove button is pressed: focus goes to the same button on the next row, or on
   * the row before it when this is the last. It says whether there was one to go to.
   */
  moveFocusToNextRow: () => boolean;
};

export type RecipeRowsProps = {
  recipes: readonly RecipeSummary[];
  /** The words of the search, which are written in bold in the names. */
  query?: string | undefined;
  /** Whether a row opens its recipe. An archived recipe is restored first, so its row does not. */
  opensRecipe: boolean;
  /** The buttons at the end of a recipe's row. */
  renderButtons: (recipe: RecipeSummary, row: RecipeRowButtons) => ReactNode;
};
