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
