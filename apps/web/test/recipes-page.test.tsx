import { RECIPES_EMPTY, RECIPES_LIBRARY } from "@keylow/core/copy";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { pagePaddingOf } from "./pagePadding";
import { recipesBackend, renderWithRecipes, resetRecipesBackend } from "./recipes/support";

import RecipesPage from "@/app/(dashboard)/recipes/page";
import { sampleRecipes } from "@/components/recipes/sampleRecipes";

describe("Recipes page", () => {
  beforeEach(() => {
    resetRecipesBackend();
  });

  afterEach(() => {
    cleanup();
  });

  it("should be titled Recipes and list the user's recipes", async () => {
    recipesBackend.rows = [...sampleRecipes];
    renderWithRecipes(<RecipesPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Recipes" })).toBeTruthy();
    expect(await screen.findByRole("table", { name: "Recipes" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Coming soon" })).toBeNull();
  });

  it("should invite the first recipe, with New recipe going to the new recipe editor", async () => {
    renderWithRecipes(<RecipesPage />);

    expect(await screen.findByRole("heading", { name: RECIPES_EMPTY.title })).toBeTruthy();
    expect(
      screen
        .getAllByRole("link", { name: RECIPES_LIBRARY.newRecipe })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/recipes/new", "/recipes/new"]);
  });

  it("should pad top and bottom as the recipe boards draw it: 16 on a phone, 24 on a desktop", async () => {
    const { container } = renderWithRecipes(<RecipesPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [16, 16],
      desktop: [24, 24],
    });
  });
});
