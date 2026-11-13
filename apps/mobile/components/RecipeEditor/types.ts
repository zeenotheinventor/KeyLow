import type { RecipeDraft, StoredRecipe } from "@keylow/core/recipes";

/** A saved recipe as the editor opens it: what `useRecipe` returns, of which only these fields matter. */
export type RecipeEditorExisting = StoredRecipe & { id: string };

export type RecipeEditorProps = {
  /** The recipe to change. Leave it out to make a new one. */
  existing?: RecipeEditorExisting | undefined;
  /** The name a new recipe starts with, such as the word typed into the library's search. */
  initialName?: string | undefined;
  /**
   * What a new recipe is filled in with, such as the recipe the assistant drafted (Save to recipes). It counts
   * as a change from an empty recipe, so leaving it asks first, and nothing is written until Save. Ignored for
   * a saved recipe.
   */
  initialDraft?: RecipeDraft | undefined;
  /** Called with the id of the recipe once it is saved, before the editor goes on to the recipe's view. */
  onSaved?: ((recipeId: string) => void) | undefined;
  /** Opens the add-ingredient search over the editor with this word typed into it, such as the food of an imported line that matched nothing. */
  initialIngredientSearch?: string | undefined;
};
