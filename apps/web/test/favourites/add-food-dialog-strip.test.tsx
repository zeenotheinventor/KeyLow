import { summaryOfStoredRecipe } from "@keylow/api-client";
import { RECIPE_BADGE } from "@keylow/core/copy";
import { buildFoodSnapshot } from "@keylow/core/diary";
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

import type { FoodWithPortionsState, RecentFood, RecipeSummary } from "@keylow/api-client";

import { AddFoodDialog } from "@/components/diary/AddFoodDialog";
import { AddIngredientDialog } from "@/components/recipes/AddIngredientDialog";

const porridge = makeFood({ id: "11111111-1111-4111-8111-111111111111", name: "Porridge" });
const porridgePortion = makePortion({
  food_id: porridge.id,
  label: "1 bowl",
  grams: 40,
  is_default: true,
});
const golden = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });
const chickenAndRice: RecipeSummary = summaryOfStoredRecipe({
  id: "55555555-5555-4555-8555-555555555555",
  name: "Chicken and rice",
  servings: 4,
  yield_grams: 1100,
  is_archived: false,
  instructions: [],
  ingredients: golden.ingredients,
});

type RecentRead = {
  data: RecentFood[] | undefined;
  isError: boolean;
  fetchStatus: "idle" | "fetching" | "paused";
};

type Hoisted = {
  useFoodWithPortions: ReturnType<typeof vi.fn<(id: string) => FoodWithPortionsState>>;
  useRecipeSearch: ReturnType<typeof vi.fn>;
  recent: { current: RecentRead };
};

const { useFoodWithPortions, useRecipeSearch, recent } = vi.hoisted((): Hoisted => ({
  useFoodWithPortions: vi.fn<(id: string) => FoodWithPortionsState>(),
  useRecipeSearch: vi.fn(),
  recent: { current: { data: [], isError: false, fetchStatus: "idle" } },
}));

// What the amount steps and Recent read is the other dialog tests' business. The favourites are real, over a
// fake database.
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useFoodWithPortions,
  useRecipeSearch,
  useRefreshOutdatedOffFood: () => undefined,
  useRecentFoods: () => recent.current,
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

const NO_RECIPES_FOUND = { recipes: [], isLoading: false, isDebouncing: false, error: null };

function renderDialog() {
  renderWithFavourites(
    <AddFoodDialog
      request={{ date: "2026-10-15" }}
      opener={null}
      onClose={vi.fn()}
      onQuickAdd={vi.fn()}
    />,
  );
}

const porridgeTile = () => screen.getByRole("button", { name: "Choose an amount of Porridge" });
const recipeTile = () =>
  screen.getByRole("button", { name: "Choose an amount of Chicken and rice, recipe" });
const strip = () => screen.getByRole("region", { name: "Favourites" });
const stripHeading = () => screen.queryByRole("heading", { name: "Favourites" });

/** The strip once its favourites have been read: its heading is there from the start, with a skeleton under it. */
const tilesShown = () => screen.findAllByRole("button", { name: /^Choose an amount of / });

/** Long enough for the skeleton's 200 ms delay to have passed, so a skeleton that was going to show has shown. */
const afterTheSkeletonDelay = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });

describe("the Favourites strip in the add food dialog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetFavouritesBackend();
    onlineManager.setOnline(true);
    favouritesBackend.foods.set(porridge.id, porridge);
    favouritesBackend.recipes.set(chickenAndRice.id, chickenAndRice);
    recent.current = { data: [], isError: false, fetchStatus: "idle" };
    useFoodWithPortions.mockReturnValue({
      status: "ready",
      food: porridge,
      portions: [porridgePortion],
    });
    useRecipeSearch.mockReturnValue(NO_RECIPES_FOUND);
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
  });

  describe("the tiles", () => {
    beforeEach(() => {
      favouritesBackend.favouriteFoodIds = [porridge.id];
      favouritesBackend.favouriteRecipeIds = [chickenAndRice.id];
    });

    it("should show a tile for each favourite food and recipe, named by what pressing it does", async () => {
      renderDialog();

      expect(await tilesShown()).toBeTruthy();
      expect(within(strip()).getAllByRole("button")).toHaveLength(2);
      expect(porridgeTile()).toBeTruthy();
      expect(recipeTile()).toBeTruthy();
    });

    it("should put the name under the circle, on the tile", async () => {
      renderDialog();

      await tilesShown();

      expect(within(porridgeTile()).getByText("Porridge")).toBeTruthy();
      expect(within(recipeTile()).getByText("Chicken and rice")).toBeTruthy();
    });

    it("should sit between Quick add and Recent", async () => {
      recent.current = {
        data: [recentPorridge()],
        isError: false,
        fetchStatus: "idle",
      };
      renderDialog();
      await tilesShown();

      const headings = screen
        .getAllByText(/^(Quick add|Favourites|Recent)/)
        .map((element) => element.textContent.split(" · ")[0]);

      expect(headings).toEqual(["Quick add", "Favourites", "Recent"]);
    });

    it("should go once something to search for is typed", async () => {
      renderDialog();
      await tilesShown();

      fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
        target: { value: "por" },
      });

      expect(stripHeading()).toBeNull();
    });

    it("should draw nothing beyond the tiles: no plus and no log action", async () => {
      renderDialog();
      await tilesShown();

      expect(within(strip()).queryByRole("button", { name: /^(Add|Log)/ })).toBeNull();
    });
  });

  describe("a press on a tile", () => {
    beforeEach(() => {
      favouritesBackend.favouriteFoodIds = [porridge.id];
      favouritesBackend.favouriteRecipeIds = [chickenAndRice.id];
    });

    it("should open a food's portion step", async () => {
      renderDialog();
      await tilesShown();

      fireEvent.click(porridgeTile());

      expect(await screen.findByRole("button", { name: "Results" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
      expect(useFoodWithPortions).toHaveBeenLastCalledWith(porridge.id);
    });

    it("should open the food at the amount last logged, with the line saying when, when Recent holds it", async () => {
      recent.current = { data: [recentPorridge()], isError: false, fetchStatus: "idle" };
      renderDialog();
      await tilesShown();

      fireEvent.click(porridgeTile());

      expect(await screen.findByText(/^Last logged 2 × 1 bowl/)).toBeTruthy();
    });

    it("should open a recipe's amount step", async () => {
      renderDialog();
      await tilesShown();

      fireEvent.click(recipeTile());

      expect(await screen.findByRole("button", { name: "Results" })).toBeTruthy();
      expect(screen.getByText(RECIPE_BADGE)).toBeTruthy();
      expect(useFoodWithPortions).not.toHaveBeenCalledWith(porridge.id);
      expect(useFoodWithPortions).not.toHaveBeenCalledWith(chickenAndRice.id);
    });

    it("should open a food that needs review on its step, with Add off", async () => {
      useFoodWithPortions.mockReturnValue({
        status: "ready",
        food: { ...porridge, fat_g: null },
        portions: [porridgePortion],
      });
      renderDialog();
      await tilesShown();

      fireEvent.click(porridgeTile());

      expect(await screen.findByRole("button", { name: "Results" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Add" }).hasAttribute("disabled")).toBe(true);
    });

    it("should say a food deleted since the strip was read does not exist, and not blame the connection", async () => {
      useFoodWithPortions.mockReturnValue({ status: "notFound" });
      renderDialog();
      await tilesShown();

      fireEvent.click(porridgeTile());

      expect(
        await screen.findByText("This food does not exist, or you cannot see it."),
      ).toBeTruthy();
      expect(screen.queryByText(/Check your connection/)).toBeNull();
    });

    it("should bring the strip back with the Results link", async () => {
      renderDialog();
      await tilesShown();
      fireEvent.click(porridgeTile());

      fireEvent.click(await screen.findByRole("button", { name: "Results" }));

      expect(await tilesShown()).toBeTruthy();
    });
  });

  describe("the keyboard", () => {
    beforeEach(() => {
      favouritesBackend.favouriteFoodIds = [porridge.id];
      favouritesBackend.favouriteRecipeIds = [chickenAndRice.id];
    });

    it("should move to the next tile on the right arrow and back on the left arrow", async () => {
      renderDialog();
      await tilesShown();
      // The recipe was favourited at the same moment, so it comes first.
      recipeTile().focus();

      fireEvent.keyDown(recipeTile(), { key: "ArrowRight" });
      expect(document.activeElement).toBe(porridgeTile());

      fireEvent.keyDown(porridgeTile(), { key: "ArrowLeft" });
      expect(document.activeElement).toBe(recipeTile());
    });

    it("should stay on the first tile at the left end and the last at the right end", async () => {
      renderDialog();
      await tilesShown();

      recipeTile().focus();
      fireEvent.keyDown(recipeTile(), { key: "ArrowLeft" });
      expect(document.activeElement).toBe(recipeTile());

      porridgeTile().focus();
      fireEvent.keyDown(porridgeTile(), { key: "ArrowRight" });
      expect(document.activeElement).toBe(porridgeTile());
    });

    it("should keep every tile in the tab order", async () => {
      renderDialog();
      await tilesShown();

      for (const tile of within(strip()).getAllByRole("button")) {
        expect(tile.tabIndex).toBe(0);
      }
    });
  });

  describe("no favourites", () => {
    it("should draw no heading", async () => {
      renderDialog();
      await waitFor(() => {
        expect(
          favouritesBackend.requests.filter((request) => request.method === "GET"),
        ).toHaveLength(2);
      });
      await afterTheSkeletonDelay();

      expect(stripHeading()).toBeNull();
      expect(screen.queryByRole("status", { name: "Loading favourites" })).toBeNull();
    });
  });

  describe("a failed read", () => {
    beforeEach(() => {
      favouritesBackend.favouriteFoodIds = [porridge.id];
      favouritesBackend.favouriteRecipeIds = [chickenAndRice.id];
      recent.current = { data: [recentPorridge()], isError: false, fetchStatus: "idle" };
    });

    async function expectNoStripAndRecentShowing() {
      await waitFor(() => {
        expect(
          favouritesBackend.requests.filter((request) => request.method === "GET"),
        ).toHaveLength(2);
      });
      await afterTheSkeletonDelay();

      expect(stripHeading()).toBeNull();
      expect(screen.queryByRole("status", { name: "Loading favourites" })).toBeNull();
      expect(screen.queryByRole("button", { name: /^Choose an amount of / })).toBeNull();
      expect(screen.getByRole("region", { name: /Recent/ })).toBeTruthy();
    }

    it("should draw no strip, and leave Recent showing, when both reads fail", async () => {
      favouritesBackend.failsReads = true;
      renderDialog();

      await expectNoStripAndRecentShowing();
    });

    it("should draw no strip, and leave Recent showing, when only the foods fail", async () => {
      favouritesBackend.failsReadsOf = "food_favourites";
      renderDialog();

      await expectNoStripAndRecentShowing();
    });

    it("should draw no strip, and leave Recent showing, when only the recipes fail", async () => {
      favouritesBackend.failsReadsOf = "recipe_favourites";
      renderDialog();

      await expectNoStripAndRecentShowing();
    });
  });

  describe("while the favourites load", () => {
    beforeEach(() => {
      favouritesBackend.hangsReads = true;
    });

    it("should show a skeleton under the heading, with Recent in its place below", async () => {
      renderDialog();

      expect(await screen.findByRole("status", { name: "Loading favourites" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Favourites" })).toBeTruthy();
    });
  });

  describe("offline", () => {
    beforeEach(() => {
      favouritesBackend.favouriteFoodIds = [porridge.id];
      onlineManager.setOnline(false);
    });

    it("should draw nothing, not an endless skeleton, when the read is paused with nothing cached", async () => {
      renderDialog();
      await afterTheSkeletonDelay();

      expect(stripHeading()).toBeNull();
      expect(screen.queryByRole("status", { name: "Loading favourites" })).toBeNull();
      expect(favouritesBackend.requests).toEqual([]);
    });

    it("should keep the tiles already read when the connection goes", async () => {
      onlineManager.setOnline(true);
      renderDialog();
      await tilesShown();

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(porridgeTile()).toBeTruthy();
    });
  });

  describe("a recipe's ingredient search", () => {
    it("should draw no strip, and read no favourites", async () => {
      favouritesBackend.favouriteFoodIds = [porridge.id];
      renderWithFavourites(<AddIngredientDialog opener={null} onClose={vi.fn()} onAdd={vi.fn()} />);
      await afterTheSkeletonDelay();

      expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeTruthy();
      expect(stripHeading()).toBeNull();
      expect(
        favouritesBackend.requests.filter((request) => request.table === "food_favourites"),
      ).toEqual([]);
    });
  });
});

function recentPorridge(): RecentFood {
  return {
    foodId: porridge.id,
    entryId: "33333333-3333-4333-8333-333333333333",
    loggedAt: "2026-10-14T18:00:00Z",
    portionId: porridgePortion.id,
    snapshot: buildFoodSnapshot(porridge, {
      quantity: 2,
      unit: "portion",
      portion: porridgePortion,
    }),
  };
}
