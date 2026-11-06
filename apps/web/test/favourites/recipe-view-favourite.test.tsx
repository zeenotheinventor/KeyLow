import { summaryOfStoredRecipe } from "@keylow/api-client";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { favouritesBackend, resetFavouritesBackend } from "./favouritesBackend";
import {
  recipeViewBackend,
  renderWithRecipeView,
  resetRecipeViewBackend,
} from "../recipes/recipeViewSupport";

import type { SavedRecipe } from "../recipes/recipeViewSupport";

import { RecipeViewScreen } from "@/components/recipes";

// The Duplicate and Archive buttons go through the router, which these tests do not use.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const RECIPE_ID = "55555555-5555-4555-8555-555555555555";
const golden = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });
const chickenAndRice: SavedRecipe = {
  id: RECIPE_ID,
  name: "Chicken and rice",
  servings: 4,
  yield_grams: 1100,
  instructions: ["Cook the rice."],
  ingredients: golden.ingredients,
};

async function showRecipe(isFavourite: boolean) {
  recipeViewBackend.recipes.set(RECIPE_ID, chickenAndRice);
  favouritesBackend.recipes.set(
    RECIPE_ID,
    summaryOfStoredRecipe({ ...chickenAndRice, is_archived: false }),
  );
  favouritesBackend.favouriteRecipeIds = isFavourite ? [RECIPE_ID] : [];
  renderWithRecipeView(<RecipeViewScreen id={RECIPE_ID} />);
  await screen.findByRole("heading", { level: 1, name: "Chicken and rice" });
}

const addHeart = () => screen.getByRole("button", { name: "Add to favourites" });
const removeHeart = () => screen.getByRole("button", { name: "Remove from favourites" });
const readHeart = () =>
  waitFor(() => {
    expect(addHeart().getAttribute("aria-disabled")).toBeNull();
  });
const writes = () => favouritesBackend.requests.filter((request) => request.method !== "GET");

describe("the favourite heart on the recipe view", () => {
  beforeEach(() => {
    resetRecipeViewBackend();
    resetFavouritesBackend();
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
  });

  it("should sit first in the row of actions, before Edit", async () => {
    await showRecipe(false);

    const names = screen
      .getAllByRole("button")
      .concat(screen.getAllByRole("link"))
      .sort((first, second) =>
        first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      )
      .map((control) => control.getAttribute("aria-label"));

    expect(names.indexOf("Add to favourites")).toBeLessThan(
      names.findIndex((name) => name?.startsWith("Edit") === true),
    );
  });

  it("should show a favourite recipe as one, as the phone set it", async () => {
    await showRecipe(true);

    expect(await screen.findByRole("button", { name: "Remove from favourites" })).toBeTruthy();
  });

  it("should favourite the recipe at once, say so in a toast and write it", async () => {
    await showRecipe(false);
    await readHeart();

    fireEvent.click(addHeart());

    expect(await screen.findByRole("button", { name: "Remove from favourites" })).toBeTruthy();
    expect(screen.getByText("Added to favourites")).toBeTruthy();
    await waitFor(() => {
      expect(writes()).toEqual([
        { method: "POST", table: "recipe_favourites", foodOrRecipeId: RECIPE_ID },
      ]);
    });
  });

  it("should unfavourite a favourite recipe and say so in a toast", async () => {
    await showRecipe(true);
    await screen.findByRole("button", { name: "Remove from favourites" });

    fireEvent.click(removeHeart());

    expect(await screen.findByRole("button", { name: "Add to favourites" })).toBeTruthy();
    expect(screen.getByText("Removed from favourites")).toBeTruthy();
  });

  it("should say the cap when the 31st favourite is refused, and put the heart back", async () => {
    favouritesBackend.writeOutcome = "refusesLimit";
    await showRecipe(false);
    await readHeart();

    fireEvent.click(addHeart());

    expect(
      await screen.findByText("You can have up to 30 favourites. Remove one to add another."),
    ).toBeTruthy();
    await waitFor(() => {
      expect(addHeart()).toBeTruthy();
    });
  });

  it("should say something went wrong when the write fails, and put the heart back", async () => {
    favouritesBackend.writeOutcome = "fails";
    await showRecipe(false);
    await readHeart();

    fireEvent.click(addHeart());

    expect(await screen.findByText("Something went wrong. Try again.")).toBeTruthy();
    await waitFor(() => {
      expect(addHeart()).toBeTruthy();
    });
  });

  it("should be disabled offline and do nothing when pressed", async () => {
    await showRecipe(false);
    await readHeart();

    act(() => {
      onlineManager.setOnline(false);
    });
    fireEvent.click(addHeart());

    expect(addHeart().getAttribute("aria-disabled")).toBe("true");
    expect(writes()).toEqual([]);
  });

  it("should be disabled until the favourites have been read", async () => {
    favouritesBackend.hangsReads = true;
    await showRecipe(false);

    expect(addHeart().getAttribute("aria-disabled")).toBe("true");
  });
});
