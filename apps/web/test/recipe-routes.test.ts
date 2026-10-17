import { describe, expect, it } from "vitest";

import { editRecipePath, newRecipePath, recipePath, recipesPath } from "@/lib/recipeRoutes";

describe("recipeRoutes", () => {
  it("should lead to the library at /recipes", () => {
    expect(recipesPath()).toBe("/recipes");
  });

  it("should lead to the editor for a new recipe at /recipes/new", () => {
    expect(newRecipePath()).toBe("/recipes/new");
  });

  it("should carry a typed name to the new recipe as the name parameter", () => {
    expect(newRecipePath("pasta")).toBe("/recipes/new?name=pasta");
  });

  it("should encode a name so it stays one value", () => {
    expect(newRecipePath("Mac & cheese #2")).toBe("/recipes/new?name=Mac%20%26%20cheese%20%232");
  });

  it("should leave out the name parameter when the name is blank", () => {
    expect(newRecipePath("   ")).toBe("/recipes/new");
  });

  it("should lead to the editor of a saved recipe at /recipes/<id>/edit", () => {
    expect(editRecipePath("11111111-1111-4111-8111-111111111111")).toBe(
      "/recipes/11111111-1111-4111-8111-111111111111/edit",
    );
  });

  // Until the recipe view exists, a row opens the editor. The recipe view ticket repoints this.
  it("should open a recipe in its editor for now", () => {
    expect(recipePath("11111111-1111-4111-8111-111111111111")).toBe(
      "/recipes/11111111-1111-4111-8111-111111111111/edit",
    );
  });
});
