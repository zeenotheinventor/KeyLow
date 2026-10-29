import {
  RECIPES_EMPTY,
  RECIPES_LIBRARY,
  RECIPES_LOADING_LABEL,
  RECIPES_LOAD_FAILED,
  RECIPES_SEARCH_EMPTY,
  RETRY_LABEL,
  SEARCH_CLEAR_LABEL,
} from "@keylow/core/copy";
import { computeRecipe } from "@keylow/core/recipes";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { recipesBackend, renderWithRecipes, resetRecipesBackend } from "./support";

import { RecipeLibrary } from "@/components/recipes";
import { archivedSampleRecipes, sampleRecipes } from "@/components/recipes/sampleRecipes";

beforeEach(() => {
  resetRecipesBackend();
  recipesBackend.rows = [...sampleRecipes, ...archivedSampleRecipes];
});

afterEach(() => {
  cleanup();
});

// The last cell of a row holds its two buttons.
const ACTIONS = "DuplicateArchive";

const openLabels = {
  beefChilli:
    "Beef chilli, 1 serving 350 grams, makes 6, 412 kilocalories, protein 34 grams, carbohydrate 31 grams, fat 16 grams, open",
  chickenAndRice:
    "Chicken and rice, 1 serving 275 grams, makes 4, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams, open",
};

async function showLibrary() {
  renderWithRecipes(<RecipeLibrary />);
  return screen.findByRole("table", { name: "Recipes" });
}

// The page has other live regions, such as the toasts', so the library's is found among them by its words.
const statusTexts = () => screen.getAllByRole("status").map((status) => status.textContent);

const searchBox = () => screen.getByRole("searchbox", { name: RECIPES_LIBRARY.searchPlaceholder });

const typeInSearch = (text: string) => {
  fireEvent.change(searchBox(), { target: { value: text } });
};

describe("RecipeLibrary", () => {
  describe("with recipes", () => {
    it("should head the page Recipes and offer New recipe, which opens the editor for a new recipe", async () => {
      await showLibrary();

      expect(screen.getByRole("heading", { level: 1, name: "Recipes" })).toBeTruthy();
      expect(
        screen.getByRole("link", { name: RECIPES_LIBRARY.newRecipe }).getAttribute("href"),
      ).toBe("/recipes/new");
    });

    it("should lead back to More, where its row is, above the heading", async () => {
      await showLibrary();

      const back = screen.getByRole("link", { name: "More" });
      expect(back.getAttribute("href")).toBe("/more");
      expect(
        back.compareDocumentPosition(screen.getByRole("heading", { level: 1, name: "Recipes" })) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("should list the five live recipes in name order with their captions and values per serving", async () => {
      const table = await showLibrary();

      const rows = within(table).getAllByRole("row").slice(1);
      expect(
        rows.map((row) =>
          within(row)
            .getAllByRole("cell")
            .map((cell) => cell.textContent),
        ),
      ).toEqual([
        ["Beef chilli1 serving (350 g)", "6", "34 g", "31 g", "16 g", "412 kcal", ACTIONS],
        ["Chicken and rice1 serving (275 g)", "4", "32 g", "43 g", "8.1 g", "374 kcal", ACTIONS],
        [
          "Lentil and tomato soup1 serving (400 g)",
          "4",
          "15 g",
          "36 g",
          "3.2 g",
          "238 kcal",
          ACTIONS,
        ],
        ["Overnight oats1 serving (290 g)", "1", "20 g", "52 g", "11 g", "389 kcal", ACTIONS],
        [
          "Spinach and cheddar frittata1 serving (155 g)",
          "4",
          "15 g",
          "3.5 g",
          "16 g",
          "217 kcal",
          ACTIONS,
        ],
      ]);
    });

    it("should say the values are per serving", async () => {
      await showLibrary();

      expect(screen.getByText(RECIPES_LIBRARY.perServingNote)).toBeTruthy();
    });

    it("should open each recipe from a link named in words", async () => {
      await showLibrary();

      expect(
        screen.getByRole("link", { name: openLabels.chickenAndRice }).getAttribute("href"),
      ).toBe("/recipes/00000000-0000-4000-8000-000000000002");
      expect(screen.getByRole("link", { name: "Chicken and rice" }).getAttribute("href")).toBe(
        "/recipes/00000000-0000-4000-8000-000000000002",
      );
    });

    it("should show the caption and stats line of a recipe in the narrow list", async () => {
      await showLibrary();

      const link = screen.getByRole("link", { name: openLabels.beefChilli });
      expect(link.textContent).toContain("1 serving (350 g) · makes 6");
      expect(link.textContent).toContain("412 kcal");
    });

    it("should show the table from 1024 px and the row cards below it, as the table's columns need the room", async () => {
      const table = await showLibrary();

      expect(table.closest(".max-lg\\:hidden")).toBeTruthy();
      expect(screen.getByRole("list", { name: "Recipes" }).className).toContain("lg:hidden");
    });

    it("should not list the archived recipes", async () => {
      await showLibrary();

      expect(screen.queryByText("Turkey meatballs")).toBeNull();
      expect(screen.queryByText("Veggie chilli")).toBeNull();
    });

    it("should agree with core on the energy and protein of the golden recipe", async () => {
      const golden = buildChickenAndRiceRecipe({ yieldGrams: 1100 });
      const computed = computeRecipe({
        servings: golden.servings,
        yieldGrams: golden.yieldGrams,
        ingredients: golden.ingredients,
      });
      recipesBackend.rows = [
        {
          id: "00000000-0000-4000-8000-0000000000f1",
          name: "Chicken and rice",
          servings: golden.servings,
          yield_grams: golden.yieldGrams,
          is_archived: false,
          computed,
        },
      ];

      const table = await showLibrary();

      const [, row] = within(table).getAllByRole("row");
      const cells = within(row ?? table).getAllByRole("cell");
      expect(cells[1]?.textContent).toBe("4");
      expect(cells[2]?.textContent).toBe("32 g");
      expect(cells[5]?.textContent).toBe("374 kcal");
    });
  });

  describe("the link to the archived recipes", () => {
    it("should count the archived recipes in its words and name, and go to the archived page", async () => {
      await showLibrary();

      const link = screen.getByRole("link", { name: "Archived recipes, 2" });
      expect(link.textContent).toBe("Archived recipes (2)");
      expect(link.getAttribute("href")).toBe("/recipes/archived");
    });

    it("should sit under the table", async () => {
      const table = await showLibrary();

      const link = screen.getByRole("link", { name: "Archived recipes, 2" });
      expect(table.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should be left out while a search is typed, and come back when it is cleared", async () => {
      await showLibrary();

      typeInSearch("chi");
      expect(screen.queryByRole("link", { name: /Archived recipes/ })).toBeNull();

      typeInSearch("");
      expect(screen.getByRole("link", { name: "Archived recipes, 2" })).toBeTruthy();
    });

    it("should be left out when nothing is archived", async () => {
      recipesBackend.rows = [...sampleRecipes];
      await showLibrary();

      expect(screen.queryByRole("link", { name: /Archived recipes/ })).toBeNull();
    });

    it("should be left out while the recipes load and when they cannot be loaded", async () => {
      recipesBackend.hangs = true;
      renderWithRecipes(<RecipeLibrary />);
      await screen.findByRole("status", { name: RECIPES_LOADING_LABEL });
      expect(screen.queryByRole("link", { name: /Archived recipes/ })).toBeNull();
      cleanup();

      recipesBackend.hangs = false;
      recipesBackend.fails = true;
      renderWithRecipes(<RecipeLibrary />);
      await screen.findByRole("heading", { name: RECIPES_LOAD_FAILED.title });
      expect(screen.queryByRole("link", { name: /Archived recipes/ })).toBeNull();
    });
  });

  describe("requests", () => {
    it("should make one recipes request, for live and archived together", async () => {
      await showLibrary();
      typeInSearch("chi");
      typeInSearch("pasta");
      typeInSearch("");

      expect(recipesBackend.reads).toHaveLength(1);
      expect(recipesBackend.reads[0]).not.toContain("is_archived=");
    });
  });

  describe("search", () => {
    it("should filter from the first character", async () => {
      const table = await showLibrary();

      typeInSearch("v");

      expect(within(table).getAllByRole("row")).toHaveLength(2);
      expect(within(table).getByRole("link", { name: "Overnight oats" })).toBeTruthy();
    });

    it("should leave the two matches for chi, with the matched letters in semibold", async () => {
      const table = await showLibrary();

      typeInSearch("chi");

      expect(
        within(table)
          .getAllByRole("link")
          .map((link) => link.textContent),
      ).toEqual(["Beef chilli", "Chicken and rice"]);
      expect(within(table).getByText("chi").className).toContain("font-semibold");
      expect(within(table).getByText("Beef").className).toContain("font-normal");
    });

    it("should say how many recipes it found once typing stops", async () => {
      await showLibrary();

      typeInSearch("chi");

      await waitFor(() => {
        expect(statusTexts()).toContain("2 recipes");
      });
    });

    it("should say 1 recipe for a single match", async () => {
      await showLibrary();

      typeInSearch("oats");

      await waitFor(() => {
        expect(statusTexts()).toContain("1 recipe");
      });
    });

    it("should say nothing while nothing is typed", async () => {
      await showLibrary();

      expect(statusTexts().every((text) => text === "")).toBe(true);
    });

    it("should offer to clear the search, which empties the field and brings every recipe back", async () => {
      const table = await showLibrary();
      typeInSearch("chi");

      fireEvent.click(screen.getByRole("button", { name: SEARCH_CLEAR_LABEL }));

      expect(searchBox()).toHaveProperty("value", "");
      expect(document.activeElement).toBe(searchBox());
      expect(within(table).getAllByRole("row")).toHaveLength(6);
    });
  });

  describe("no matches", () => {
    it("should say no recipes were found and offer a New recipe that carries the typed word", async () => {
      await showLibrary();

      typeInSearch("pasta");

      expect(
        screen.getByRole("heading", { level: 2, name: RECIPES_SEARCH_EMPTY.title }),
      ).toBeTruthy();
      expect(screen.getByText(RECIPES_SEARCH_EMPTY.body)).toBeTruthy();
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.queryByText(RECIPES_LIBRARY.perServingNote)).toBeNull();
      const links = screen.getAllByRole("link", { name: RECIPES_LIBRARY.newRecipe });
      expect(links.map((link) => link.getAttribute("href"))).toEqual([
        "/recipes/new",
        "/recipes/new?name=pasta",
      ]);
    });

    it("should keep the field, so the search can be changed", async () => {
      await showLibrary();

      typeInSearch("pasta");

      expect(searchBox()).toBeTruthy();
    });
  });

  describe("empty", () => {
    it("should invite the first recipe, with no field and no table", async () => {
      recipesBackend.rows = [];
      renderWithRecipes(<RecipeLibrary />);

      expect(
        await screen.findByRole("heading", { level: 2, name: RECIPES_EMPTY.title }),
      ).toBeTruthy();
      expect(screen.getByText(RECIPES_EMPTY.body)).toBeTruthy();
      expect(screen.queryByRole("searchbox")).toBeNull();
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.getAllByRole("link", { name: RECIPES_LIBRARY.newRecipe })).toHaveLength(2);
    });

    it("should still invite the first recipe when every recipe is archived, with the link to them under it", async () => {
      recipesBackend.rows = [...archivedSampleRecipes];
      renderWithRecipes(<RecipeLibrary />);

      const title = await screen.findByRole("heading", { level: 2, name: RECIPES_EMPTY.title });
      const link = screen.getByRole("link", { name: "Archived recipes, 2" });
      expect(title.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should not offer the archived recipes when there are none", async () => {
      recipesBackend.rows = [];
      renderWithRecipes(<RecipeLibrary />);

      await screen.findByRole("heading", { level: 2, name: RECIPES_EMPTY.title });
      expect(screen.queryByRole("link", { name: /Archived recipes/ })).toBeNull();
    });
  });

  describe("loading", () => {
    it("should name the loading region and disable the field", async () => {
      recipesBackend.hangs = true;
      renderWithRecipes(<RecipeLibrary />);

      expect(await screen.findByRole("status", { name: RECIPES_LOADING_LABEL })).toBeTruthy();
      expect(searchBox()).toHaveProperty("disabled", true);
      expect(screen.getByText(RECIPES_LIBRARY.perServingNote)).toBeTruthy();
    });
  });

  describe("error", () => {
    it("should say the recipes could not be loaded, with no field, and no raw error text", async () => {
      recipesBackend.fails = true;
      renderWithRecipes(<RecipeLibrary />);

      expect(
        await screen.findByRole("heading", { level: 2, name: RECIPES_LOAD_FAILED.title }),
      ).toBeTruthy();
      expect(screen.getByText(RECIPES_LOAD_FAILED.body)).toBeTruthy();
      expect(screen.queryByRole("searchbox")).toBeNull();
      expect(screen.queryByText(/database unavailable/)).toBeNull();
    });

    it("should read the recipes again when Try again is pressed", async () => {
      recipesBackend.fails = true;
      renderWithRecipes(<RecipeLibrary />);
      const tryAgain = await screen.findByRole("button", { name: RETRY_LABEL });

      recipesBackend.fails = false;
      fireEvent.click(tryAgain);

      expect(await screen.findByRole("table", { name: "Recipes" })).toBeTruthy();
      expect(recipesBackend.reads).toHaveLength(2);
    });
  });
});
