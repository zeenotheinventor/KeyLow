import {
  GENERIC_ERROR,
  OFFLINE_BANNER,
  RECIPE_NOT_FOUND,
  RECIPE_VIEW,
  RETRY_LABEL,
  describeEditRecipe,
} from "@keylow/core/copy";
import { SPOON_PORTIONS } from "@keylow/core/nutrition";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { buildChickenAndRiceRecipe, buildFood, buildFoodPortion } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  recipeViewBackend,
  renderWithRecipeView,
  resetRecipeViewBackend,
} from "./recipeViewSupport";

import type { SavedRecipe } from "./recipeViewSupport";

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
  instructions: ["Cook the rice.", "Fry the chicken.", "Stir the rice in."],
  ingredients: golden.ingredients,
};

const [, tablespoon] = SPOON_PORTIONS;
if (tablespoon === undefined) {
  throw new Error("The spoon portions must include a tablespoon");
}
const largeEgg = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000b1",
  label: "1 large",
  grams: 50,
});
const mediumOnion = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000b2",
  label: "1 medium",
  grams: 110,
});

const frittata: SavedRecipe = {
  id: "66666666-6666-4666-8666-666666666666",
  name: "Spinach and cheddar frittata",
  servings: 4,
  yield_grams: 620,
  instructions: [],
  ingredients: [
    buildRecipeIngredient(
      buildFood({ id: "00000000-0000-4000-8000-0000000000c1", name: "Eggs, chicken, whole, raw" }),
      { quantity: 6, unit: "portion", portion: largeEgg },
    ),
    buildRecipeIngredient(
      buildFood({
        id: "00000000-0000-4000-8000-0000000000c2",
        name: "Milk, semi-skimmed",
        density_g_per_ml: 1.03,
      }),
      { quantity: 100, unit: "ml" },
    ),
    buildRecipeIngredient(
      buildFood({
        id: "00000000-0000-4000-8000-0000000000c3",
        name: "Oil, olive",
        density_g_per_ml: 0.92,
      }),
      { quantity: 1, unit: "portion", portion: tablespoon },
    ),
    buildRecipeIngredient(
      buildFood({ id: "00000000-0000-4000-8000-0000000000c4", name: "Onions, raw" }),
      { quantity: 1, unit: "portion", portion: mediumOnion },
    ),
    buildRecipeIngredient(
      buildFood({ id: "00000000-0000-4000-8000-0000000000c5", name: "Spinach, baby, raw" }),
      { quantity: 100, unit: "g" },
    ),
    buildRecipeIngredient(
      buildFood({ id: "00000000-0000-4000-8000-0000000000c6", name: "Cheese, Cheddar" }),
      { quantity: 60, unit: "g" },
    ),
  ],
};

function store(recipe: SavedRecipe) {
  recipeViewBackend.recipes.set(recipe.id, recipe);
}

async function showRecipe(recipe: SavedRecipe = chickenAndRice) {
  store(recipe);
  const { push } = renderWithRecipeView(<RecipeViewScreen id={recipe.id} />);
  await screen.findByRole("heading", { level: 1, name: recipe.name });

  return { push };
}

const servingsField = () => screen.getByRole<HTMLInputElement>("spinbutton", { name: "Servings" });
const plusButton = () => screen.getByRole("button", { name: RECIPE_VIEW.moreServings });
const minusButton = () => screen.getByRole("button", { name: RECIPE_VIEW.fewerServings });
const resetButton = () => screen.getByRole("button", { name: /^Back to / });
const perServingCard = () => screen.getByRole("region", { name: "Per serving" });
const amountOf = (rowName: string) => screen.getByRole("listitem", { name: rowName });

function type(field: HTMLElement, text: string) {
  fireEvent.change(field, { target: { value: text } });
}

beforeEach(() => {
  resetRecipeViewBackend();
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("RecipeViewScreen", () => {
  describe("a recipe at its own servings", () => {
    it("should head the page with the recipe's name and a way back to the library", async () => {
      await showRecipe();

      expect(screen.getByRole("link", { name: "Recipes" }).getAttribute("href")).toBe("/recipes");
    });

    it("should show the Per serving card: 374 kcal, 275 g, 32 g protein, 136 kcal per 100 g cooked", async () => {
      await showRecipe();

      expect(within(perServingCard()).getByText("374")).toBeTruthy();
      expect(within(perServingCard()).getByText("Per serving (275 g)")).toBeTruthy();
      expect(within(perServingCard()).getByText("32 g")).toBeTruthy();
      expect(within(perServingCard()).getByText("Per 100 g cooked: 136 kcal")).toBeTruthy();
    });

    it("should show the servings as a spinbutton reading 4 servings, with the yield line", async () => {
      await showRecipe();

      expect(servingsField().value).toBe("4");
      expect(servingsField().getAttribute("aria-valuetext")).toBe("4 servings");
      expect(screen.getByText("Makes 4 · 1,100 g cooked")).toBeTruthy();
    });

    it("should list the ingredients as written, with the count and the servings they are for", async () => {
      await showRecipe();

      expect(screen.getByRole("heading", { name: /^Ingredients/ }).textContent).toBe(
        "Ingredients · 3",
      );
      expect(screen.getByText("For 4 servings")).toBeTruthy();
      expect(
        within(screen.getByRole("region", { name: /^Ingredients/ }))
          .getAllByRole("listitem")
          .map((row) => row.getAttribute("aria-label")),
      ).toEqual(["Chicken breast, 500 g", "Dry rice, 200 g", "Olive oil, 20 g"]);
    });

    it("should list the steps in full, in order, under the count, with no servings line yet", async () => {
      await showRecipe();
      const steps = screen.getByRole("region", { name: /^Instructions/ });

      expect(within(steps).getByRole("heading").textContent).toBe("Instructions · 3");
      expect(
        within(steps)
          .getAllByRole("listitem")
          .map((step) => step.textContent),
      ).toEqual(["1Cook the rice.", "2Fry the chicken.", "3Stir the rice in."]);
      expect(screen.queryByText(/The steps are written for/)).toBeNull();
    });

    it("should not show an Instructions card for a recipe with no steps", async () => {
      await showRecipe(frittata);

      expect(screen.queryByRole("heading", { name: /^Instructions/ })).toBeNull();
    });

    it("should open an archived recipe like a live one, and say nothing about it being archived", async () => {
      await showRecipe({ ...chickenAndRice, is_archived: true });

      expect(screen.queryByText(/archived/i)).toBeNull();
      expect(
        screen.getByRole("link", { name: describeEditRecipe("Chicken and rice") }),
      ).toBeTruthy();
    });

    it("should have Edit going to the editor", async () => {
      await showRecipe();

      expect(
        screen
          .getByRole("link", { name: describeEditRecipe("Chicken and rice") })
          .getAttribute("href"),
      ).toBe(`/recipes/${RECIPE_ID}/edit`);
      expect(
        screen.getByRole("link", { name: describeEditRecipe("Chicken and rice") }).textContent,
      ).toBe(RECIPE_VIEW.edit);
    });
  });

  describe("changing the servings", () => {
    it("should scale the amounts and the yield by 1.5 when More servings is pressed twice", async () => {
      await showRecipe();

      fireEvent.click(plusButton());
      fireEvent.click(plusButton());

      expect(servingsField().value).toBe("6");
      expect(servingsField().getAttribute("aria-valuetext")).toBe("6 servings");
      expect(amountOf("Chicken breast, 750 g")).toBeTruthy();
      expect(amountOf("Dry rice, 300 g")).toBeTruthy();
      expect(amountOf("Olive oil, 30 g")).toBeTruthy();
      expect(screen.getByText("Makes 6 · 1,650 g cooked")).toBeTruthy();
      expect(screen.getByText("For 6 servings")).toBeTruthy();
      expect(screen.getByText("The steps are written for 4 servings.")).toBeTruthy();
    });

    it("should leave the Per serving card as it was", async () => {
      await showRecipe();
      const before = perServingCard().textContent;

      fireEvent.click(plusButton());
      fireEvent.click(plusButton());

      expect(perServingCard().textContent).toBe(before);
      expect(within(perServingCard()).getByText("374")).toBeTruthy();
    });

    it("should say the new amounts once, politely, after a button press", async () => {
      await showRecipe();

      fireEvent.click(plusButton());
      fireEvent.click(plusButton());

      expect(screen.getAllByText("Ingredients for 6 servings, 1,650 grams cooked")).toHaveLength(1);
    });

    it("should step with ArrowUp and ArrowDown in the field", async () => {
      await showRecipe();

      fireEvent.keyDown(servingsField(), { key: "ArrowUp" });
      fireEvent.keyDown(servingsField(), { key: "ArrowUp" });
      fireEvent.keyDown(servingsField(), { key: "ArrowDown" });

      expect(servingsField().value).toBe("5");
      expect(amountOf("Chicken breast, 625 g")).toBeTruthy();
    });

    it("should offer a way back to the recipe's own servings only once scaled", async () => {
      await showRecipe();
      expect(screen.queryByRole("button", { name: /^Back to / })).toBeNull();

      fireEvent.click(plusButton());

      expect(resetButton().textContent).toBe("Back to 4 servings");
    });

    it("should put the recipe's own amounts back on Reset, take the link away and focus the field", async () => {
      await showRecipe();
      fireEvent.click(plusButton());
      fireEvent.click(plusButton());

      fireEvent.click(resetButton());

      expect(servingsField().value).toBe("4");
      expect(amountOf("Chicken breast, 500 g")).toBeTruthy();
      expect(amountOf("Dry rice, 200 g")).toBeTruthy();
      expect(amountOf("Olive oil, 20 g")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Back to / })).toBeNull();
      expect(screen.queryByText(/The steps are written for/)).toBeNull();
      expect(document.activeElement).toBe(servingsField());
      expect(screen.getByText("Ingredients for 4 servings, 1,100 grams cooked")).toBeTruthy();
    });

    it("should follow a typed number at once, and say it 500 ms after typing stops", async () => {
      await showRecipe();

      type(servingsField(), "7");

      expect(amountOf("Chicken breast, 875 g")).toBeTruthy();
      expect(screen.queryByText(/^Ingredients for 7 servings/)).toBeNull();
      await waitFor(() => {
        expect(screen.getByText("Ingredients for 7 servings, 1,925 grams cooked")).toBeTruthy();
      });
    });

    describe.each(["0", "", "1001", "2.5", "abc"])("a typed %j", (text) => {
      it("should say what to enter, keep the last good amounts, and put the number back on leaving", async () => {
        await showRecipe();
        fireEvent.click(plusButton());
        fireEvent.click(plusButton());

        type(servingsField(), text);

        expect(screen.getByRole("alert").textContent).toBe(RECIPE_VIEW.servingsProblem);
        expect(servingsField().getAttribute("aria-invalid")).toBe("true");
        expect(amountOf("Chicken breast, 750 g")).toBeTruthy();
        expect(amountOf("Dry rice, 300 g")).toBeTruthy();
        expect(amountOf("Olive oil, 30 g")).toBeTruthy();

        fireEvent.blur(servingsField());

        expect(servingsField().value).toBe("6");
        expect(screen.queryByRole("alert")).toBeNull();
        expect(amountOf("Chicken breast, 750 g")).toBeTruthy();
      });
    });

    it("should stop Fewer servings at 1 and More servings at 1,000", async () => {
      await showRecipe();

      type(servingsField(), "1");
      expect(minusButton().getAttribute("aria-disabled")).toBe("true");
      expect(plusButton().getAttribute("aria-disabled")).toBeNull();
      fireEvent.click(minusButton());
      expect(servingsField().value).toBe("1");

      type(servingsField(), "1000");
      expect(plusButton().getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(plusButton());
      expect(servingsField().value).toBe("1000");
    });

    it("should scale a portion, a spoon and a millilitre amount in their own units", async () => {
      await showRecipe(frittata);

      fireEvent.click(minusButton());
      fireEvent.click(minusButton());

      expect(
        within(screen.getByRole("region", { name: /^Ingredients/ }))
          .getAllByRole("listitem")
          .map((row) => row.getAttribute("aria-label")),
      ).toEqual([
        "Eggs, chicken, whole, raw, 3 × 1 large (150 g)",
        "Milk, semi-skimmed, 50 ml",
        "Oil, olive, 0.5 tbsp (7.5 ml)",
        "Onions, raw, 0.5 × 1 medium (55 g)",
        "Spinach, baby, raw, 50 g",
        "Cheese, Cheddar, 30 g",
      ]);
      expect(screen.getByText("Makes 2 · 310 g cooked")).toBeTruthy();
      expect(within(perServingCard()).getByText("Per serving (155 g)")).toBeTruthy();
    });

    it("should write a quarter of a spoon and of an onion at one serving", async () => {
      await showRecipe(frittata);

      type(servingsField(), "1");

      expect(amountOf("Oil, olive, 0.25 tbsp (3.8 ml)")).toBeTruthy();
      expect(amountOf("Onions, raw, 0.25 × 1 medium (28 g)")).toBeTruthy();
    });

    it("should start a recipe saved at 2.5 servings at 2.5, step to whole numbers and accept 2.5 back", async () => {
      await showRecipe({ ...chickenAndRice, servings: 2.5, yield_grams: 550 });
      expect(servingsField().value).toBe("2.5");

      fireEvent.click(plusButton());
      expect(servingsField().value).toBe("3");
      expect(resetButton().textContent).toBe("Back to 2.5 servings");

      type(servingsField(), "2.5");
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("button", { name: /^Back to / })).toBeNull();
    });

    it("should follow the recipe's servings when they change after its own were typed back", async () => {
      await showRecipe({ ...chickenAndRice, servings: 2.5, yield_grams: 550 });
      fireEvent.click(plusButton());
      type(servingsField(), "2.5");

      // The recipe is edited elsewhere, and the page reads it again when the person comes back to it.
      store({ ...chickenAndRice, servings: 3, yield_grams: 660 });
      act(() => {
        window.dispatchEvent(new Event("visibilitychange"));
      });

      expect(await screen.findByText("Makes 3 · 660 g cooked")).toBeTruthy();
      expect(servingsField().getAttribute("aria-valuenow")).toBe("3");
      expect(screen.queryByRole("button", { name: /^Back to / })).toBeNull();
    });

    it("should say the recipe's own fractional servings once typing stops", async () => {
      await showRecipe({ ...chickenAndRice, servings: 2.5, yield_grams: 550 });
      fireEvent.click(plusButton());
      type(servingsField(), "2.5");

      expect(
        await screen.findByText("Ingredients for 2.5 servings, 550 grams cooked"),
      ).toBeTruthy();
    });

    it("should only read: nothing is saved or sent while the servings change", async () => {
      await showRecipe();

      fireEvent.click(plusButton());
      fireEvent.click(plusButton());
      type(servingsField(), "9");
      type(servingsField(), "0");
      fireEvent.blur(servingsField());
      fireEvent.click(minusButton());
      fireEvent.click(resetButton());

      expect(recipeViewBackend.requests.every((request) => request.method === "GET")).toBe(true);
      expect(recipeViewBackend.requests.every((request) => request.path.endsWith("/recipes"))).toBe(
        true,
      );
    });
  });

  describe("offline", () => {
    it("should say so, disable Edit alone, and keep the servings working", async () => {
      await showRecipe();

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByText(OFFLINE_BANNER.title)).toBeTruthy();
      expect(screen.getByText(RECIPE_VIEW.offlineBody)).toBeTruthy();
      const edit = screen.getByRole("button", { name: describeEditRecipe("Chicken and rice") });
      expect(edit.getAttribute("aria-disabled")).toBe("true");
      expect(screen.queryByRole("link", { name: /^Edit / })).toBeNull();
      expect(plusButton().getAttribute("aria-disabled")).toBeNull();
      expect(servingsField().disabled).toBe(false);

      fireEvent.click(plusButton());

      expect(amountOf("Chicken breast, 625 g")).toBeTruthy();
    });
  });

  describe("offline Edit", () => {
    const offlineEdit = async () => {
      const { push } = await showRecipe();
      act(() => {
        onlineManager.setOnline(false);
      });

      return {
        push,
        edit: screen.getByRole("button", { name: describeEditRecipe("Chicken and rice") }),
      };
    };

    it("should take no pointer, so it shows no hover or press feedback", async () => {
      const { edit } = await offlineEdit();

      expect(edit.classList.contains("aria-disabled:pointer-events-none")).toBe(true);
    });

    it("should go nowhere when pressed with the pointer or the keyboard", async () => {
      const { push, edit } = await offlineEdit();

      fireEvent.click(edit);
      fireEvent.keyDown(edit, { key: "Enter" });
      fireEvent.keyDown(edit, { key: " " });

      expect(push).not.toHaveBeenCalled();
      expect(screen.getByRole("heading", { level: 1, name: "Chicken and rice" })).toBeTruthy();
    });
  });

  describe("while it loads, fails or is not there", () => {
    it("should show the way back and a Loading recipe region while the recipe is on its way", () => {
      recipeViewBackend.hangs = true;
      renderWithRecipeView(<RecipeViewScreen id={RECIPE_ID} />);

      expect(screen.getByRole("link", { name: "Recipes" }).getAttribute("href")).toBe("/recipes");
      expect(screen.getByRole("status", { name: "Loading recipe" })).toBeTruthy();
    });

    it("should say something went wrong, and read the recipe again on Try again", async () => {
      store(chickenAndRice);
      recipeViewBackend.fails = true;
      renderWithRecipeView(<RecipeViewScreen id={RECIPE_ID} />);

      await screen.findByText(GENERIC_ERROR);
      expect(screen.getByRole("link", { name: "Recipes" })).toBeTruthy();
      expect(screen.queryByText(/database unavailable/)).toBeNull();

      recipeViewBackend.fails = false;
      fireEvent.click(screen.getByRole("button", { name: RETRY_LABEL }));

      expect(
        await screen.findByRole("heading", { level: 1, name: "Chicken and rice" }),
      ).toBeTruthy();
    });

    it("should say the recipe is not found, with the way back, when it is not there", async () => {
      renderWithRecipeView(<RecipeViewScreen id={RECIPE_ID} />);

      expect(await screen.findByRole("heading", { name: RECIPE_NOT_FOUND.title })).toBeTruthy();
      expect(screen.getByText(RECIPE_NOT_FOUND.body)).toBeTruthy();
      expect(screen.getByRole("link", { name: "Recipes" })).toBeTruthy();
    });

    it("should not ask about a link that cannot be a recipe", () => {
      renderWithRecipeView(<RecipeViewScreen id="not-a-recipe" />);

      expect(screen.getByRole("heading", { name: RECIPE_NOT_FOUND.title })).toBeTruthy();
      expect(recipeViewBackend.requests).toEqual([]);
    });
  });
});
