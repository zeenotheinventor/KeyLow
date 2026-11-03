export type RecipeEditorScreenProps = {
  /** The id of the recipe, from the route's address. */
  id: string;
  /** The word the editor's add-ingredient search opens with, from the address. Leave it out to open the editor alone. */
  addIngredientQuery?: string | undefined;
};
