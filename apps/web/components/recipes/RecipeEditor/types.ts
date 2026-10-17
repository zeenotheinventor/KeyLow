import type { StoredRecipe } from "@keylow/core/recipes";

/** A saved recipe as the editor opens it: what `useRecipe` returns, of which only these fields matter. */
export type RecipeEditorExisting = StoredRecipe & { id: string };

export type RecipeEditorProps = {
  /** The recipe to change. Leave it out to make a new one. */
  existing?: RecipeEditorExisting | undefined;
  /** The name a new recipe starts with, such as the word typed into the library's search. */
  initialName?: string | undefined;
};
