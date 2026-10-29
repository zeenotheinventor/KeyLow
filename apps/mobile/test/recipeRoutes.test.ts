import {
  NEW_RECIPE_NAME_PARAMETER,
  archivedRecipesPath,
  editRecipePath,
  newRecipePath,
  recipePath,
  recipesPath,
  refreshRecipePath,
} from "../lib/recipeRoutes";

describe("where the recipe library leads", () => {
  it("should name the library /more/recipes, a screen of the More tab", () => {
    expect(recipesPath()).toBe("/more/recipes");
  });

  it("should open the empty editor for a new recipe", () => {
    expect(newRecipePath()).toBe("/recipes/new");
  });

  it("should carry a typed word to the editor in the name parameter", () => {
    expect(NEW_RECIPE_NAME_PARAMETER).toBe("name");
    expect(newRecipePath("pasta")).toBe("/recipes/new?name=pasta");
  });

  it("should keep the word as typed, encoded for an address", () => {
    expect(newRecipePath("Mac & cheese")).toBe("/recipes/new?name=Mac%20%26%20cheese");
  });

  it("should leave out a word that is only spaces, and trim the ends of one that is not", () => {
    expect(newRecipePath("   ")).toBe("/recipes/new");
    expect(newRecipePath("  pasta ")).toBe("/recipes/new?name=pasta");
  });

  it("should lead to the editor of a saved recipe at /recipes/<id>/edit", () => {
    expect(editRecipePath("0b5f4b6e-1c1b-4d6f-8f5e-3d2f6f0a9a11")).toBe(
      "/recipes/0b5f4b6e-1c1b-4d6f-8f5e-3d2f6f0a9a11/edit",
    );
  });

  it("should open a recipe on its view at /recipes/<id>", () => {
    expect(recipePath("0b5f4b6e-1c1b-4d6f-8f5e-3d2f6f0a9a11")).toBe(
      "/recipes/0b5f4b6e-1c1b-4d6f-8f5e-3d2f6f0a9a11",
    );
  });

  it("should lead to the refresh of a recipe's ingredients at /recipes/<id>/refresh", () => {
    expect(refreshRecipePath("0b5f4b6e-1c1b-4d6f-8f5e-3d2f6f0a9a11")).toBe(
      "/recipes/0b5f4b6e-1c1b-4d6f-8f5e-3d2f6f0a9a11/refresh",
    );
  });

  it("should lead to the archived recipes at /more/recipes/archived, inside the More tab", () => {
    expect(archivedRecipesPath()).toBe("/more/recipes/archived");
  });
});
