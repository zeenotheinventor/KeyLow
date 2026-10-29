/** The query parameter that carries a typed word to the new recipe editor, which reads it as the recipe's name. */
export const NEW_RECIPE_NAME_PARAMETER = "name";

/** The recipe library. */
export const recipesPath = (): string => "/recipes";

/** The editor for a new recipe. A typed name is carried to it as `NEW_RECIPE_NAME_PARAMETER`. */
export const newRecipePath = (name?: string): string => {
  const trimmedName = name?.trim() ?? "";

  return trimmedName === ""
    ? `${recipesPath()}/new`
    : `${recipesPath()}/new?${NEW_RECIPE_NAME_PARAMETER}=${encodeURIComponent(trimmedName)}`;
};

/** The editor for a saved recipe. */
export const editRecipePath = (id: string): string => `${recipesPath()}/${id}/edit`;

/** The recipe view, the screen a library row opens and where the editor's Back and Save lead. */
export const recipePath = (id: string): string => `${recipesPath()}/${id}`;

/**
 * The amount step of a recipe, in the foods sheet: where a "Your recipes" row of the log search leads. The caller
 * adds the day and hour the sheet carries (`withLogContext`).
 */
export const logRecipePath = (id: string): string => `/foods/recipe/${id}/log`;

/** The screen that shows what "Refresh ingredients" would change in a saved recipe, pushed over its view. */
export const refreshRecipePath = (id: string): string => `${recipesPath()}/${id}/refresh`;

/** The archived recipes, a screen pushed inside the Recipes tab so the tab bar stays. */
export const archivedRecipesPath = (): string => `${recipesPath()}/archived`;

/**
 * The shopping list, a full-height screen outside the tabs. The path is written out in full, so it stays
 * where it is whichever tab the library lives under.
 */
export const shoppingListPath = (): string => "/recipes/shopping";

/** The query parameter that carries the servings to add a recipe at, as the view or the picker chose them. */
export const ADD_TO_LIST_SERVINGS_PARAMETER = "servings";

/** The screen that adds a recipe's ingredients to the shopping list, pushed over the screen it came from. */
export const addToListPath = (id: string, servings: number): string =>
  `/recipes/${id}/add-to-list?${ADD_TO_LIST_SERVINGS_PARAMETER}=${encodeURIComponent(String(servings))}`;
