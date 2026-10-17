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

/**
 * The screen a library row opens, and where the editor's Back and Save lead. The recipe view will be at
 * `/recipes/<id>`, but until it exists this is the editor. The recipe view ticket changes this one line.
 */
export const recipePath = (id: string): string => editRecipePath(id);
