import { RECIPE_EDITOR, RECIPE_PROBLEMS, RECIPE_TOASTS } from "@keylow/core/copy";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { oliveOil } from "../diary/portionFoods";
import { makeFood, makePortion, makeSearchHit } from "../foods/support";

import type { RecipeEditorExisting } from "@/components/recipes";
import type { FoodSearchHit } from "@keylow/api-client";
import type { Food, FoodPortion } from "@keylow/core/schemas";

import { RecipeEditor } from "@/components/recipes";
import { ToastProvider } from "@/components/ui/Toast";

type Api = {
  hits: FoodSearchHit[];
  foods: Map<string, Food>;
  portions: Map<string, FoodPortion[]>;
};

const api = vi.hoisted((): Api => ({ hits: [], foods: new Map(), portions: new Map() }));
const { createRecipe, updateRecipe } = vi.hoisted(() => ({
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useCreateRecipe: () => ({ mutateAsync: createRecipe }),
  useUpdateRecipe: () => ({ mutateAsync: updateRecipe }),
  useFoodSearch: (query: string) => ({
    local: query.trim().length >= 2 ? api.hits : [],
    off: [],
    isLoadingLocal: false,
    isLoadingOff: false,
    isDebouncing: false,
    offError: null,
    localError: null,
  }),
  useFoodWithPortions: (id: string) => {
    const food = api.foods.get(id);
    return food === undefined
      ? { status: "notFound" }
      : { status: "ready", food, portions: api.portions.get(id) ?? [] };
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// Clear of the serials in `portionFoods`, whose olive oil these tests share.
const idOf = (serial: number) => `22222222-2222-4222-8222-${String(serial).padStart(12, "0")}`;

const SPINACH_BABY_ID = idOf(1);
const SPINACH_MATURE_ID = idOf(2);
const SPINACH_BOILED_ID = idOf(3);
const ONION_ID = idOf(4);

function cofidFood(
  id: string,
  name: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
) {
  return makeFood({
    id,
    name,
    source: "cofid",
    source_ref: id,
    kcal,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
  });
}

const spinachBaby = cofidFood(SPINACH_BABY_ID, "Spinach, baby, raw", 16, 2.6, 0.2, 0.6);
const spinachMature = cofidFood(SPINACH_MATURE_ID, "Spinach, mature, raw", 25, 2.8, 1.6, 0.8);
const spinachBoiled = cofidFood(
  SPINACH_BOILED_ID,
  "Spinach, mature, boiled in unsalted water",
  19,
  2.2,
  0.8,
  0.8,
);
const onions = cofidFood(ONION_ID, "Onions, raw", 35, 1, 8, 0.1);
const onionPortions = [
  makePortion({ id: idOf(41), food_id: ONION_ID, label: "1 small", grams: 70, position: 0 }),
  makePortion({
    id: idOf(42),
    food_id: ONION_ID,
    label: "1 medium",
    grams: 110,
    is_default: true,
    position: 1,
  }),
  makePortion({ id: idOf(43), food_id: ONION_ID, label: "1 large", grams: 160, position: 2 }),
];

function hitOf(food: Food, portion?: FoodPortion): FoodSearchHit {
  return makeSearchHit({
    id: food.id,
    name: food.name,
    source: food.source,
    kcal: food.kcal,
    protein_g: food.protein_g,
    fat_g: food.fat_g,
    carbs_g: food.carbs_g,
    quality: food.quality,
    default_portion_id: portion?.id ?? null,
    default_portion_label: portion?.label ?? null,
    default_portion_grams: portion?.grams ?? null,
    default_portion_ml: portion?.ml ?? null,
  });
}

const RECIPE_ID = "55555555-5555-4555-8555-555555555555";
const golden = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });

function recipeWith(ingredients: RecipeEditorExisting["ingredients"]): RecipeEditorExisting {
  return {
    id: RECIPE_ID,
    name: "Chicken and rice",
    servings: golden.servings,
    yield_grams: golden.yieldGrams,
    instructions: [],
    ingredients,
  };
}

function showEditor(existing: RecipeEditorExisting = recipeWith(golden.ingredients)) {
  render(
    <ToastProvider>
      <RecipeEditor existing={existing} />
    </ToastProvider>,
  );
}

const table = () => within(screen.getByRole("table", { name: "Ingredients" }));
const ingredientNames = () =>
  table()
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent);
const amountOf = (name: string) =>
  within(table().getByRole("row", { name: new RegExp(name) })).getAllByRole("cell")[1]?.textContent;
const addIngredientButton = () => screen.getByRole("button", { name: "Add ingredient" });
const addDialog = () => screen.getByRole("dialog", { name: "Add ingredient" });
const editDialog = () => screen.getByRole("dialog", { name: "Edit ingredient" });
const inDialog = () => within(screen.getByRole("dialog"));
const amountField = () => screen.getByRole<HTMLInputElement>("textbox", { name: /^Amount/ });
const chipNames = () => screen.getAllByRole("radio").map((chip) => chip.textContent);

function search(text: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
    target: { value: text },
  });
}

const resultRows = () =>
  within(screen.getByRole("group", { name: "Search results" })).getAllByRole("listitem");

function chooseResult(name: RegExp) {
  const row = resultRows().find((candidate) => name.test(candidate.textContent));
  if (row === undefined) {
    throw new Error("The result is missing");
  }
  fireEvent.click(within(row).getByRole("button"));
}

function typeAmount(text: string) {
  fireEvent.change(amountField(), { target: { value: text } });
}

beforeEach(() => {
  vi.resetAllMocks();
  api.hits = [hitOf(spinachBaby), hitOf(spinachMature), hitOf(spinachBoiled), hitOf(onions)];
  api.foods = new Map(
    [spinachBaby, spinachMature, spinachBoiled, onions, oliveOil.food].map((food) => [
      food.id,
      food,
    ]),
  );
  api.portions = new Map([[ONION_ID, onionPortions]]);
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("adding an ingredient", () => {
  it("should open the dialog Add ingredient with the cursor in the search and nothing to log a time for", () => {
    showEditor();

    fireEvent.click(addIngredientButton());

    expect(addDialog()).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Search foods" }));
    expect(screen.queryByRole("button", { name: /^Time/ })).toBeNull();
  });

  it("should offer no Quick add row before anything is typed", () => {
    showEditor();

    fireEvent.click(addIngredientButton());

    expect(screen.queryByRole("button", { name: /Quick add/ })).toBeNull();
  });

  it("should list the spinach rows with a chevron, no plus and no recipes group", () => {
    showEditor();
    fireEvent.click(addIngredientButton());

    search("spinach");

    expect(resultRows()).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /^Add Spinach/ })).toBeNull();
    expect(screen.queryByText(/recipes/i)).toBeNull();
    expect(within(resultRows()[0] ?? document.body).getByRole("button").textContent).toContain(
      "Spinach, baby, raw",
    );
  });

  it("should open the amount step with the Results link, the food and no Time field when a row is chosen", () => {
    showEditor();
    fireEvent.click(addIngredientButton());
    search("spinach");

    chooseResult(/baby/);

    expect(screen.getByRole("button", { name: "Results" })).toBeTruthy();
    expect(inDialog().getByText("For 100 g")).toBeTruthy();
    expect(amountField().value).toBe("100");
    expect(screen.queryByText("Time")).toBeNull();
    expect(inDialog().getByRole("button", { name: "Add to recipe" })).toBeTruthy();
    expect(inDialog().getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("should go back to the results with what was typed", () => {
    showEditor();
    fireEvent.click(addIngredientButton());
    search("spinach");
    chooseResult(/baby/);

    fireEvent.click(screen.getByRole("button", { name: "Results" }));

    expect(screen.getByRole<HTMLInputElement>("searchbox", { name: "Search foods" }).value).toBe(
      "spinach",
    );
  });

  it("should show Onions, raw at 1 medium as 39 kcal with the small, medium, large and g chips", () => {
    showEditor();
    fireEvent.click(addIngredientButton());
    search("onions");

    chooseResult(/Onions/);

    expect(inDialog().getByText("For 1 medium (110 g)")).toBeTruthy();
    expect(inDialog().getByText("39")).toBeTruthy();
    expect(chipNames()).toEqual(["1 small", "1 medium", "1 large", "g"]);
    expect(screen.getByRole("radio", { name: "1 medium", checked: true })).toBeTruthy();
  });

  it("should show Oil, olive at 1 tbsp as 124 kcal, with g, ml, 1 tsp and 1 tbsp and no natural portion", () => {
    api.hits = [hitOf(oliveOil.food)];
    showEditor();
    fireEvent.click(addIngredientButton());
    search("olive");
    chooseResult(/Oil, olive/);

    fireEvent.click(screen.getByRole("radio", { name: "1 tbsp" }));

    expect(chipNames()).toEqual(["g", "ml", "1 tsp", "1 tbsp"]);
    expect(screen.getByRole("radio", { name: "1 tbsp", checked: true })).toBeTruthy();
    expect(amountField().value).toBe("1");
    expect(inDialog().getByText("For 1 tbsp (15 ml, 14 g)")).toBeTruthy();
    expect(inDialog().getByText("124")).toBeTruthy();
  });

  it("should reset the amount to 1 for a portion chip and 100 for g", () => {
    showEditor();
    fireEvent.click(addIngredientButton());
    search("onions");
    chooseResult(/Onions/);
    typeAmount("3");

    fireEvent.click(screen.getByRole("radio", { name: "1 large" }));
    expect(amountField().value).toBe("1");

    fireEvent.click(screen.getByRole("radio", { name: "g" }));
    expect(amountField().value).toBe("100");
  });

  it("should ask for an amount above 0 and switch Add to recipe off while there is none", () => {
    showEditor();
    fireEvent.click(addIngredientButton());
    search("spinach");
    chooseResult(/baby/);

    typeAmount("0");

    expect(screen.getByText("Enter an amount above 0.")).toBeTruthy();
    expect(inDialog().getByRole("button", { name: "Add to recipe" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("should append the ingredient, change the card, close the dialog and give focus back to Add ingredient", async () => {
    showEditor();
    const perServingBefore = screen.getByRole("region", { name: "Per serving" }).textContent;
    fireEvent.click(addIngredientButton());
    search("spinach");
    chooseResult(/baby/);

    fireEvent.click(inDialog().getByRole("button", { name: "Add to recipe" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(ingredientNames()).toEqual([
      "Chicken breast",
      "Dry rice",
      "Olive oil",
      "Spinach, baby, raw",
    ]);
    expect(amountOf("Spinach")).toBe("100 g");
    expect(screen.getByRole("heading", { name: /^Ingredients/ }).textContent).toBe(
      "Ingredients · 4",
    );
    expect(document.activeElement).toBe(addIngredientButton());
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Per serving" }).textContent).not.toBe(
        perServingBefore,
      );
    });
  });

  it("should add an ingredient at 1 medium as 1 medium (110 g)", () => {
    showEditor();
    fireEvent.click(addIngredientButton());
    search("onions");
    chooseResult(/Onions/);

    fireEvent.click(inDialog().getByRole("button", { name: "Add to recipe" }));

    expect(amountOf("Onions")).toBe("1 medium (110 g)");
  });

  it("should save nothing until Save is pressed", () => {
    showEditor();
    fireEvent.click(addIngredientButton());
    search("spinach");
    chooseResult(/baby/);
    fireEvent.click(inDialog().getByRole("button", { name: "Add to recipe" }));

    expect(createRecipe).not.toHaveBeenCalled();
    expect(updateRecipe).not.toHaveBeenCalled();
  });

  it("should close on Cancel and leave the ingredients as they were", () => {
    showEditor();
    fireEvent.click(addIngredientButton());
    search("spinach");
    chooseResult(/baby/);

    fireEvent.click(inDialog().getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(ingredientNames()).toHaveLength(3);
    expect(document.activeElement).toBe(addIngredientButton());
  });

  it("should stay usable offline, since it only changes the draft", () => {
    onlineManager.setOnline(false);
    showEditor();

    expect(addIngredientButton().hasAttribute("disabled")).toBe(false);
    fireEvent.click(addIngredientButton());
    search("spinach");
    chooseResult(/baby/);
    fireEvent.click(inDialog().getByRole("button", { name: "Add to recipe" }));

    expect(ingredientNames()).toHaveLength(4);
  });
});

describe("a food that needs review", () => {
  const SUSPECT_ID = idOf(9);
  const suspect = makeFood({
    id: SUSPECT_ID,
    name: "Mystery stew",
    source: "cofid",
    source_ref: SUSPECT_ID,
    kcal: 90,
    protein_g: 4,
    carbs_g: 10,
    fat_g: null,
  });

  beforeEach(() => {
    api.hits = [hitOf(suspect)];
    api.foods.set(SUSPECT_ID, suspect);
  });

  function chooseSuspect() {
    fireEvent.click(addIngredientButton());
    search("stew");
    chooseResult(/Mystery stew/);
  }

  it("should link to copying it in a new tab, saying so, and keep Add to recipe off", () => {
    showEditor();
    chooseSuspect();

    const link = inDialog().getByRole("link", { name: "Copy to your foods (opens in a new tab)" });

    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
    expect(link.getAttribute("href")).toMatch(new RegExp(`/foods/new\\?from=${SUSPECT_ID}$`));
    expect(inDialog().getByRole("button", { name: "Add to recipe" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("should leave the draft as it was when the dialog is cancelled", () => {
    showEditor();
    chooseSuspect();

    fireEvent.click(inDialog().getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(ingredientNames()).toEqual(["Chicken breast", "Dry rice", "Olive oil"]);
  });
});

describe("the most ingredients a recipe holds", () => {
  const hundred = Array.from({ length: 100 }, () => golden.ingredients[0]).flatMap((ingredient) =>
    ingredient === undefined ? [] : [ingredient],
  );

  it("should switch Add ingredient off and say Up to 100 ingredients at 100", () => {
    showEditor(recipeWith(hundred));

    expect(addIngredientButton().hasAttribute("disabled")).toBe(true);
    expect(addIngredientButton().getAttribute("aria-describedby")).toBe(
      screen.getByText(RECIPE_PROBLEMS.ingredientLimit).id,
    );
  });

  it("should give focus to the limit caption when the 100th ingredient switches the button off", () => {
    showEditor(recipeWith(hundred.slice(0, 99)));
    fireEvent.click(addIngredientButton());
    search("spinach");
    chooseResult(/baby/);

    fireEvent.click(inDialog().getByRole("button", { name: "Add to recipe" }));

    expect(addIngredientButton().hasAttribute("disabled")).toBe(true);
    expect(document.activeElement).toBe(screen.getByText(RECIPE_PROBLEMS.ingredientLimit));
  });

  it("should not take focus when the page opens full", () => {
    showEditor(recipeWith(hundred));

    expect(document.activeElement).toBe(document.body);
  });

  it("should leave Add ingredient on at 99", () => {
    showEditor(recipeWith(hundred.slice(0, 99)));

    expect(addIngredientButton().hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText(RECIPE_PROBLEMS.ingredientLimit)).toBeNull();
  });

  it("should say why instead of failing when Undo meets a full list", () => {
    showEditor(recipeWith(hundred));
    fireEvent.click(
      table().getAllByRole("button", { name: "Remove Chicken breast" })[0] ?? document.body,
    );
    fireEvent.click(addIngredientButton());
    search("spinach");
    chooseResult(/baby/);
    fireEvent.click(inDialog().getByRole("button", { name: "Add to recipe" }));
    expect(addIngredientButton().hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.getByText(RECIPE_PROBLEMS.ingredientLimit, { selector: "span" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^Ingredients/ }).textContent).toBe(
      "Ingredients · 100",
    );
  });
});

describe("editing an ingredient", () => {
  const openEdit = (name: string) => {
    fireEvent.click(table().getByRole("button", { name: `Edit ${name}` }));
  };

  it("should open Edit ingredient on the ingredient's amount and unit, with Save, Cancel and Remove from recipe", () => {
    showEditor();

    openEdit("Dry rice");

    expect(editDialog()).toBeTruthy();
    expect(amountField().value).toBe("200");
    expect(screen.getByRole("radio", { name: "g", checked: true })).toBeTruthy();
    expect(inDialog().getByRole("button", { name: "Save" })).toBeTruthy();
    expect(inDialog().getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(inDialog().getByRole("button", { name: RECIPE_EDITOR.removeFromRecipe })).toBeTruthy();
    expect(screen.queryByText("Time")).toBeNull();
    expect(document.activeElement).toBe(amountField());
  });

  it("should change the amount in place and keep the order", () => {
    showEditor();
    openEdit("Dry rice");

    typeAmount("250");
    fireEvent.click(inDialog().getByRole("button", { name: "Save" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(ingredientNames()).toEqual(["Chicken breast", "Dry rice", "Olive oil"]);
    expect(amountOf("Dry rice")).toBe("250 g");
    expect(document.activeElement).toBe(table().getByRole("button", { name: "Edit Dry rice" }));
    expect(updateRecipe).not.toHaveBeenCalled();
  });

  it("should leave the ingredient as it was when Cancel is pressed", () => {
    showEditor();
    openEdit("Dry rice");
    typeAmount("250");

    fireEvent.click(inDialog().getByRole("button", { name: "Cancel" }));

    expect(amountOf("Dry rice")).toBe("200 g");
  });

  it("should not save an amount that is not above 0", () => {
    showEditor();
    openEdit("Dry rice");

    typeAmount("0");

    expect(screen.getByText("Enter an amount above 0.")).toBeTruthy();
    expect(inDialog().getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
  });

  it("should offer the chips of the food's portions and select the one the ingredient was added with", () => {
    const medium = onionPortions[1];
    if (medium === undefined) {
      throw new Error("The medium portion is missing");
    }
    const twoMedium = buildRecipeIngredient(onions, {
      quantity: 2,
      unit: "portion",
      portion: medium,
    });
    showEditor(recipeWith([twoMedium]));

    openEdit("Onions, raw");

    expect(chipNames()).toEqual(["1 small", "1 medium", "1 large", "g"]);
    expect(screen.getByRole("radio", { name: "1 medium", checked: true })).toBeTruthy();
    expect(amountField().value).toBe("2");
  });

  it("should keep the values the ingredient was added with, since only Refresh ingredients moves them", () => {
    // The food has been changed since: 100 kcal per 100 g now, 35 when the ingredient was added.
    api.foods.set(ONION_ID, { ...onions, kcal: 100 });
    const medium = onionPortions[1];
    if (medium === undefined) {
      throw new Error("The medium portion is missing");
    }
    showEditor(
      recipeWith([
        buildRecipeIngredient(onions, { quantity: 1, unit: "portion", portion: medium }),
      ]),
    );
    openEdit("Onions, raw");

    fireEvent.click(screen.getByRole("radio", { name: "g" }));
    typeAmount("200");
    fireEvent.click(inDialog().getByRole("button", { name: "Save" }));

    expect(
      within(table().getByRole("row", { name: /Onions/ })).getAllByRole("cell")[5]?.textContent,
    ).toBe("70 kcal");
  });

  it("should still open when the food has gone, from the ingredient's own values", () => {
    api.foods.clear();
    showEditor();

    openEdit("Dry rice");

    expect(amountField().value).toBe("200");
    expect(inDialog().getByText("720")).toBeTruthy();
  });
});

describe("removing an ingredient", () => {
  const removeButton = (name: string) => table().getByRole("button", { name: `Remove ${name}` });

  it("should remove at once and say Ingredient removed with Undo", () => {
    showEditor();

    fireEvent.click(removeButton("Dry rice"));

    expect(ingredientNames()).toEqual(["Chicken breast", "Olive oil"]);
    expect(screen.getByText(RECIPE_TOASTS.ingredientRemoved)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    expect(updateRecipe).not.toHaveBeenCalled();
  });

  it("should put the ingredient back in its place on Undo", () => {
    showEditor();
    fireEvent.click(removeButton("Dry rice"));

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(ingredientNames()).toEqual(["Chicken breast", "Dry rice", "Olive oil"]);
    expect(amountOf("Dry rice")).toBe("200 g");
  });

  it("should put the last ingredient back at the end", () => {
    showEditor();
    fireEvent.click(removeButton("Olive oil"));

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(ingredientNames()).toEqual(["Chicken breast", "Dry rice", "Olive oil"]);
  });

  it("should change the Per serving card with the removal and with the Undo", async () => {
    vi.useFakeTimers();
    showEditor();
    const before = screen.getByRole("region", { name: "Per serving" }).textContent;

    fireEvent.click(removeButton("Olive oil"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    const without = screen.getByRole("region", { name: "Per serving" }).textContent;
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    vi.useRealTimers();

    expect(without).not.toBe(before);
    expect(screen.getByRole("region", { name: "Per serving" }).textContent).toBe(before);
  });

  it("should remove from the edit dialog with the same toast and Undo", () => {
    showEditor();
    fireEvent.click(table().getByRole("button", { name: "Edit Dry rice" }));

    fireEvent.click(inDialog().getByRole("button", { name: RECIPE_EDITOR.removeFromRecipe }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(ingredientNames()).toEqual(["Chicken breast", "Olive oil"]);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(ingredientNames()).toEqual(["Chicken breast", "Dry rice", "Olive oil"]);
  });

  describe("while the Edit ingredient dialog is open on another ingredient", () => {
    // Dry rice is removed, so Olive oil moves up to where Dry rice was. Undo then puts Dry rice back above it.
    const openOliveOilThenUndo = () => {
      showEditor();
      fireEvent.click(removeButton("Dry rice"));
      fireEvent.click(table().getByRole("button", { name: "Edit Olive oil" }));
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    };

    it("should save the new amount onto the ingredient the dialog was opened on", () => {
      openOliveOilThenUndo();

      typeAmount("30");
      fireEvent.click(inDialog().getByRole("button", { name: "Save" }));

      expect(ingredientNames()).toEqual(["Chicken breast", "Dry rice", "Olive oil"]);
      expect(amountOf("Dry rice")).toBe("200 g");
      expect(amountOf("Olive oil")).toBe("30 g");
    });

    it("should remove the ingredient the dialog was opened on", () => {
      openOliveOilThenUndo();

      fireEvent.click(inDialog().getByRole("button", { name: RECIPE_EDITOR.removeFromRecipe }));

      expect(ingredientNames()).toEqual(["Chicken breast", "Dry rice"]);
    });
  });

  it("should remove offline, since it only changes the draft", () => {
    onlineManager.setOnline(false);
    showEditor();

    fireEvent.click(removeButton("Dry rice"));

    expect(ingredientNames()).toHaveLength(2);
  });

  it("should let the stacked rows at the narrow width remove and edit too", () => {
    showEditor();
    const list = within(screen.getByRole("list", { name: "Ingredients" }));

    expect(list.getAllByRole("button", { name: /^Edit / })).toHaveLength(3);
    fireEvent.click(list.getByRole("button", { name: "Remove Dry rice" }));

    expect(ingredientNames()).toEqual(["Chicken breast", "Olive oil"]);
  });
});
