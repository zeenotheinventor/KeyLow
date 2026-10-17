import { SAVE_FAILED_BANNER, SEARCH_EMPTY, SEARCH_STATUS } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RecipeLogProvider,
  holdInserts,
  holdSearches,
  recipeLogBackend,
  resetRecipeLogBackend,
} from "./recipeLogBackend";
import { makeSearchHit } from "../foods/support";

import type { AddFoodRequest } from "@/lib/foodLogActions";
import type { FoodSearchHit, RecipeSummary } from "@keylow/api-client";

import { AddFoodDialog, SearchStep } from "@/components/diary/AddFoodDialog";
import { archivedSampleRecipes, sampleRecipes } from "@/components/recipes/sampleRecipes";
import { ToastProvider } from "@/components/ui/Toast";

const api = vi.hoisted(() => ({ hits: [] as FoodSearchHit[] }));

// The foods are the existing tests' business. The recipe search, the log and the Undo are the real hooks.
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "UTC" }),
  useFoodSearch: (query: string) => ({
    local: query.trim().length >= 2 ? api.hits : [],
    off: [],
    isLoadingLocal: false,
    isLoadingOff: false,
    isDebouncing: false,
    offError: null,
    localError: null,
  }),
}));

function sampleRecipeNamed(name: string): RecipeSummary {
  const recipe = sampleRecipes.find((candidate) => candidate.name === name);
  if (recipe === undefined) {
    throw new Error(`The sample recipes have no ${name}`);
  }
  return recipe;
}

const chickenAndRice = sampleRecipeNamed("Chicken and rice");

const rowName =
  "Chicken and rice, recipe, 1 serving 275 grams, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams";
const plusName = "Add Chicken and rice, 1 serving (275 g)";

const breastFillets = makeSearchHit({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Chicken breast fillets",
  source: "user",
  kcal: 120,
  protein_g: 22.5,
  carbs_g: 0,
  fat_g: 2.1,
});
const grilledBreast = makeSearchHit({
  id: "11111111-1111-4111-8111-222222222222",
  name: "Chicken breast, grilled",
  source: "cofid",
  kcal: 148,
  protein_g: 32,
  carbs_g: 0,
  fat_g: 2.2,
});

// 12:40 on Thursday 15 October 2026 in UTC.
const NOW = new Date("2026-10-15T12:40:30Z");

function renderDialog(request: AddFoodRequest = { date: "2026-10-15", time: "18:00" }) {
  const onClose = vi.fn<() => void>();
  render(
    <RecipeLogProvider>
      <ToastProvider>
        <AddFoodDialog request={request} opener={null} onClose={onClose} onQuickAdd={vi.fn()} />
      </ToastProvider>
    </RecipeLogProvider>,
  );

  return { onClose };
}

function search(text: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
    target: { value: text },
  });
}

const recipesGroup = () =>
  screen.findByRole("region", { name: "Your recipes, values per serving" });
const recipeRow = async () => within(await recipesGroup()).getByRole("listitem", { name: rowName });
const plus = async () => within(await recipeRow()).getByRole("button", { name: plusName });

function withRecipe(change: (recipe: RecipeSummary) => RecipeSummary) {
  recipeLogBackend.recipes = [change(chickenAndRice)];
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  resetRecipeLogBackend();
  recipeLogBackend.recipes = [...sampleRecipes, ...archivedSampleRecipes];
  api.hits = [breastFillets, grilledBreast];
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe("the add food dialog, recipes", () => {
  describe("the group", () => {
    it("should come first, then Your foods, then Common foods", async () => {
      renderDialog();
      search("chicken");
      await recipesGroup();

      expect(
        screen.getAllByRole("region").map((region) => region.getAttribute("aria-label") ?? ""),
      ).toEqual(["Your recipes, values per serving", "", ""]);
      expect(
        within(screen.getByRole("group", { name: "Search results" }))
          .getAllByRole("heading", { level: 2 })
          .map((heading) => heading.textContent),
      ).toEqual(["Your recipes · Per serving", "Your foods · Yours", "Common foods · UK CoFID"]);
    });

    it("should be absent when no recipe matches", async () => {
      renderDialog();
      search("rice and");
      recipeLogBackend.recipes = [];
      search("chicken");

      await screen.findByRole("region", { name: "Your foods" });
      await waitFor(() => {
        expect(recipeLogBackend.searches.length).toBeGreaterThan(0);
      });
      expect(screen.queryByRole("region", { name: "Your recipes, values per serving" })).toBeNull();
    });

    it("should be absent from the idle list, and ask for no recipes", () => {
      renderDialog();

      expect(screen.getByRole("button", { name: /Quick add/ })).toBeTruthy();
      expect(screen.queryByRole("region", { name: "Your recipes, values per serving" })).toBeNull();
      expect(recipeLogBackend.searches).toEqual([]);
    });

    it("should be the only group, with no nothing-found message, when only a recipe matches", async () => {
      api.hits = [];
      renderDialog();
      search("chicken");

      await recipesGroup();

      expect(screen.queryByText(SEARCH_EMPTY.title)).toBeNull();
      expect(screen.getAllByRole("region")).toHaveLength(1);
    });

    it("should not say nothing was found while the recipes are still being searched for", async () => {
      api.hits = [];
      const release = holdSearches();
      renderDialog();
      search("chicken");
      await waitFor(() => {
        expect(recipeLogBackend.searches).toHaveLength(1);
      });

      expect(screen.getByText(SEARCH_STATUS.searchingYourFoods)).toBeTruthy();
      expect(screen.queryByText(SEARCH_EMPTY.title)).toBeNull();

      release();
      await recipesGroup();
      expect(screen.queryByText(SEARCH_EMPTY.title)).toBeNull();
    });

    it("should not offer an archived recipe", async () => {
      recipeLogBackend.recipes = [
        ...sampleRecipes,
        {
          ...chickenAndRice,
          id: chickenAndRice.id.replace(/1$/, "9"),
          name: "Chicken curry",
          is_archived: true,
        },
      ];
      renderDialog();
      search("chicken");

      const group = await recipesGroup();

      expect(within(group).queryByText(/curry/)).toBeNull();
      expect(within(group).getAllByRole("listitem")).toHaveLength(1);
    });

    it("should not offer a recipe with no weight", async () => {
      withRecipe((recipe) => ({ ...recipe, computed: { ...recipe.computed, effectiveGrams: 0 } }));
      renderDialog();
      search("chicken");

      await screen.findByRole("region", { name: "Your foods" });
      await waitFor(() => {
        expect(recipeLogBackend.searches.length).toBeGreaterThan(0);
      });
      expect(screen.queryByRole("region", { name: "Your recipes, values per serving" })).toBeNull();
    });

    it("should not offer a recipe with a missing value", async () => {
      withRecipe((recipe) => ({
        ...recipe,
        computed: {
          ...recipe.computed,
          perServing: { ...recipe.computed.perServing, fat_g: null },
        },
      }));
      renderDialog();
      search("chicken");

      await screen.findByRole("region", { name: "Your foods" });
      await waitFor(() => {
        expect(recipeLogBackend.searches.length).toBeGreaterThan(0);
      });
      expect(screen.queryByRole("region", { name: "Your recipes, values per serving" })).toBeNull();
    });

    it("should leave the food groups as they are, and show no alert, when the recipe search fails", async () => {
      recipeLogBackend.failsSearch = true;
      renderDialog();
      search("chicken");

      await screen.findByRole("region", { name: "Your foods" });
      await waitFor(() => {
        expect(recipeLogBackend.searches.length).toBeGreaterThan(0);
      });

      expect(screen.getByRole("region", { name: "Common foods" })).toBeTruthy();
      expect(screen.queryByRole("region", { name: "Your recipes, values per serving" })).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByText(/RAW/)).toBeNull();
    });

    it("should drop the recipes already on show when a refetch of the same search fails", async () => {
      renderDialog();
      search("chicken");
      await recipesGroup();

      // The recipes go stale, the window is focused again and the refetch fails.
      recipeLogBackend.failsSearch = true;
      vi.setSystemTime(new Date(NOW.getTime() + 60_000));
      window.dispatchEvent(new Event("visibilitychange"));

      await waitFor(() => {
        expect(
          screen.queryByRole("region", { name: "Your recipes, values per serving" }),
        ).toBeNull();
      });
      expect(screen.getByRole("region", { name: "Your foods" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Common foods" })).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("should not be in the ingredient search, which does not ask for recipes", () => {
      render(
        <RecipeLogProvider>
          <SearchStep
            mode="ingredient"
            query="chicken"
            onQueryChange={vi.fn()}
            onOpenFood={vi.fn()}
          />
        </RecipeLogProvider>,
      );

      expect(screen.queryByRole("region", { name: "Your recipes, values per serving" })).toBeNull();
      expect(recipeLogBackend.searches).toEqual([]);
    });
  });

  describe("the row", () => {
    it("should be named in words, without choose amount, because it opens nothing yet", async () => {
      renderDialog();
      search("chicken");

      expect(await recipeRow()).toBeTruthy();
    });

    it("should show the serving and the values of one serving", async () => {
      renderDialog();
      search("chicken");

      const row = await recipeRow();

      expect(within(row).getByText("1 serving (275 g)")).toBeTruthy();
      expect(within(row).getByText("374")).toBeTruthy();
      expect(within(row).getByText("32 P")).toBeTruthy();
      expect(within(row).getByText("43 C")).toBeTruthy();
      expect(within(row).getByText("8.1 F")).toBeTruthy();
    });

    it("should write the matched letters of the name in bold and the rest regular", async () => {
      renderDialog();
      search("chicken");

      const row = await recipeRow();

      expect(within(row).getByText("Chicken").className).toContain("font-semibold");
      expect(within(row).getByText("and rice", { exact: false }).className).toContain(
        "font-normal",
      );
    });

    it("should be plain text with only the plus to press, until the amount step can open", async () => {
      renderDialog();
      search("chicken");

      const row = await recipeRow();

      expect(
        within(row)
          .getAllByRole("button")
          .map((button) => button.getAttribute("aria-label")),
      ).toEqual([plusName]);
    });
  });

  describe("the plus", () => {
    it("should log one serving at the hour the dialog was opened for, in one request", async () => {
      renderDialog({ date: "2026-10-15", time: "18:00" });
      search("chicken");

      fireEvent.click(await plus());

      await screen.findByText("Added Chicken and rice");
      expect(recipeLogBackend.inserts).toHaveLength(1);
      expect(recipeLogBackend.inserts[0]).toMatchObject({
        item_type: "recipe",
        recipe_id: chickenAndRice.id,
        quantity: 1,
        unit: "serving",
        local_date: "2026-10-15",
        logged_at: "2026-10-15T18:00:00.000Z",
      });
    });

    it("should log at the moment the dialog opened when no hour was asked for", async () => {
      renderDialog({ date: "2026-10-15" });
      search("chicken");

      fireEvent.click(await plus());

      await screen.findByText("Added Chicken and rice");
      expect(recipeLogBackend.inserts[0]).toMatchObject({ logged_at: "2026-10-15T12:40:30.000Z" });
    });

    it("should leave the dialog open, so more can be added", async () => {
      const { onClose } = renderDialog();
      search("chicken");

      fireEvent.click(await plus());
      await screen.findByText("Added Chicken and rice");

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Add food" })).toBeTruthy();
      expect(screen.getByRole("searchbox", { name: "Search foods" })).toHaveProperty(
        "value",
        "chicken",
      );
    });

    it("should log a double press once", async () => {
      const release = holdInserts();
      renderDialog();
      search("chicken");
      const button = await plus();

      fireEvent.click(button);
      fireEvent.click(button);
      release();

      await screen.findByText("Added Chicken and rice");
      expect(recipeLogBackend.inserts).toHaveLength(1);
    });

    it("should undo only the entry that its own toast logged", async () => {
      renderDialog();
      search("chicken");
      fireEvent.click(await plus());
      await screen.findByText("Added Chicken and rice");

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(recipeLogBackend.deletedIds).toEqual(["00000000-0000-4000-8000-000000000901"]);
      });
    });

    it("should say it was not saved, and never the failure or the recipe, when the log fails", async () => {
      recipeLogBackend.failsInsert = true;
      renderDialog();
      search("chicken");

      fireEvent.click(await plus());

      expect(await screen.findByText(SAVE_FAILED_BANNER)).toBeTruthy();
      expect(screen.queryByText(/RAW/)).toBeNull();
      expect(screen.queryByText(/Added/)).toBeNull();
    });

    it("should be off when there is no connection, and log nothing when pressed", async () => {
      renderDialog();
      search("chicken");
      const button = await plus();

      await waitFor(() => {
        onlineManager.setOnline(false);
        expect(button.getAttribute("aria-disabled")).toBe("true");
      });
      fireEvent.click(button);
      fireEvent.keyDown(button, { key: "Enter" });

      expect(recipeLogBackend.inserts).toEqual([]);
    });
  });
});
