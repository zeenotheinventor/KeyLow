import { summaryOfStoredRecipe } from "@keylow/api-client";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  favouritesBackend,
  renderWithFavourites,
  resetFavouritesBackend,
} from "./favouritesBackend";
import { makeFood, makePortion } from "../foods/support";

import type { FoodWithPortionsState, RecipeSummary } from "@keylow/api-client";

import { AddFoodDialog } from "@/components/diary/AddFoodDialog";

const food = makeFood({ name: "Porridge oats" });
const golden = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });
const recipe: RecipeSummary = summaryOfStoredRecipe({
  id: "55555555-5555-4555-8555-555555555555",
  name: "Chicken and rice",
  servings: 4,
  yield_grams: 1100,
  is_archived: false,
  instructions: [],
  ingredients: golden.ingredients,
});

const { useFoodWithPortions, useRecipeSearch } = vi.hoisted(() => ({
  useFoodWithPortions: vi.fn<(id: string) => FoodWithPortionsState>(),
  useRecipeSearch: vi.fn(),
}));

// What the amount steps read is the other dialog tests' business. The favourites are real, over a fake database.
// This file imports the api-client before its own helpers, so the helper is loaded inside the factory.
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  ...(await import("../diary/noPlateHooks")).noPlateHooks,
  useFoodWithPortions,
  useRecipeSearch,
  useRefreshOutdatedOffFood: () => undefined,
  useRecentFoods: () => ({ data: [], isError: false, fetchStatus: "idle" }),
  useProfileTimeZone: () => ({ data: "UTC" }),
  useFoodSearch: () => ({
    local: [],
    off: [],
    isLoadingLocal: false,
    isLoadingOff: false,
    isDebouncing: false,
    offError: null,
    localError: null,
  }),
}));

function renderDialog(request: { date: string; foodId?: string }) {
  renderWithFavourites(<AddFoodDialog request={request} opener={null} onClose={vi.fn()} />);
}

const addHeart = () => screen.getByRole("button", { name: "Add to favourites" });
const readHeart = () =>
  waitFor(() => {
    expect(addHeart().getAttribute("aria-disabled")).toBeNull();
  });
const writes = () => favouritesBackend.requests.filter((request) => request.method !== "GET");

async function openRecipeStep() {
  useRecipeSearch.mockReturnValue({
    recipes: [recipe],
    isLoading: false,
    isDebouncing: false,
    error: null,
  });
  renderDialog({ date: "2026-10-15" });
  fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
    target: { value: "chicken" },
  });
  const group = await screen.findByRole("region", { name: "Your recipes, values per serving" });
  fireEvent.click(within(group).getByRole("button", { name: /^Chicken\s*and rice/ }));
  await screen.findByRole("button", { name: "Results" });
}

describe("the favourite heart on the add food dialog's amount steps", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetFavouritesBackend();
    onlineManager.setOnline(true);
    favouritesBackend.foods.set(food.id, food);
    favouritesBackend.recipes.set(recipe.id, recipe);
    useFoodWithPortions.mockReturnValue({ status: "ready", food, portions: [makePortion()] });
    useRecipeSearch.mockReturnValue({
      recipes: [],
      isLoading: false,
      isDebouncing: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
  });

  describe("the portion step", () => {
    it("should show a heart in the Results row, and none on the search", async () => {
      renderDialog({ date: "2026-10-15" });
      expect(screen.queryByRole("button", { name: /favourites$/ })).toBeNull();
      cleanup();

      renderDialog({ date: "2026-10-15", foodId: food.id });

      expect(await screen.findByRole("button", { name: "Add to favourites" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Results" })).toBeTruthy();
    });

    it("should show a favourite food as one", async () => {
      favouritesBackend.favouriteFoodIds = [food.id];
      renderDialog({ date: "2026-10-15", foodId: food.id });

      expect(await screen.findByRole("button", { name: "Remove from favourites" })).toBeTruthy();
    });

    it("should favourite the food, say so in a toast and keep the dialog open on the amount", async () => {
      renderDialog({ date: "2026-10-15", foodId: food.id });
      await readHeart();

      fireEvent.click(addHeart());

      expect(await screen.findByRole("button", { name: "Remove from favourites" })).toBeTruthy();
      expect(screen.getByText("Added to favourites")).toBeTruthy();
      expect(screen.getByRole("dialog")).toBeTruthy();
      await waitFor(() => {
        expect(writes()).toEqual([
          { method: "POST", table: "food_favourites", foodOrRecipeId: food.id },
        ]);
      });
    });

    it("should say something went wrong when the write fails, and put the heart back", async () => {
      favouritesBackend.writeOutcome = "fails";
      renderDialog({ date: "2026-10-15", foodId: food.id });
      await readHeart();

      fireEvent.click(addHeart());

      expect(await screen.findByText("Something went wrong. Try again.")).toBeTruthy();
      await waitFor(() => {
        expect(addHeart()).toBeTruthy();
      });
    });

    it("should be disabled offline and do nothing when pressed", async () => {
      renderDialog({ date: "2026-10-15", foodId: food.id });
      await readHeart();

      act(() => {
        onlineManager.setOnline(false);
      });
      fireEvent.click(addHeart());

      expect(addHeart().getAttribute("aria-disabled")).toBe("true");
      expect(writes()).toEqual([]);
    });

    it("should have no heart while the food has not loaded", () => {
      useFoodWithPortions.mockReturnValue({ status: "loading" });
      renderDialog({ date: "2026-10-15", foodId: food.id });

      expect(screen.queryByRole("button", { name: /favourites$/ })).toBeNull();
    });
  });

  describe("the recipe amount step", () => {
    it("should show a heart beside the Results link and favourite the recipe", async () => {
      await openRecipeStep();
      await readHeart();

      fireEvent.click(addHeart());

      expect(await screen.findByRole("button", { name: "Remove from favourites" })).toBeTruthy();
      expect(screen.getByText("Added to favourites")).toBeTruthy();
      await waitFor(() => {
        expect(writes()).toEqual([
          { method: "POST", table: "recipe_favourites", foodOrRecipeId: recipe.id },
        ]);
      });
    });

    it("should say the cap when the 31st favourite is refused, and put the heart back", async () => {
      favouritesBackend.writeOutcome = "refusesLimit";
      await openRecipeStep();
      await readHeart();

      fireEvent.click(addHeart());

      expect(
        await screen.findByText("You can have up to 30 favourites. Remove one to add another."),
      ).toBeTruthy();
      await waitFor(() => {
        expect(addHeart()).toBeTruthy();
      });
    });

    it("should be disabled offline", async () => {
      await openRecipeStep();
      await readHeart();

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(addHeart().getAttribute("aria-disabled")).toBe("true");
    });
  });
});
