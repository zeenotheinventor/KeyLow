import { SAVE_FAILED_BANNER } from "@keylow/core/copy";
import { buildRecipeLogEntry } from "@keylow/core/diary";
import { formatCalories, formatGrams } from "@keylow/core/format";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RecipeLogProvider,
  holdInserts,
  recipeLogBackend,
  resetRecipeLogBackend,
} from "./recipeLogBackend";

import type { AddFoodRequest } from "@/lib/foodLogActions";
import type { RecipeSummary } from "@keylow/api-client";

import { AddFoodDialog } from "@/components/diary/AddFoodDialog";
import { sampleRecipes } from "@/components/recipes/sampleRecipes";
import { ToastProvider } from "@/components/ui/Toast";

// The foods are the existing tests' business. The recipe search, the amount step and the log are real.
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
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

const sampleChickenAndRice = sampleRecipes.find((recipe) => recipe.name === "Chicken and rice");
if (sampleChickenAndRice === undefined) {
  throw new Error("The sample recipes have no Chicken and rice");
}

/** The golden recipe as the library holds it: 1,100 g cooked, so 275 g is one serving. */
const withCookedWeight: RecipeSummary = sampleChickenAndRice;

/**
 * The same recipe saved without a cooked weight, so its 720 g of raw ingredients is the total (180 g a
 * serving), and a gram of it carries the dish's totals over 720 g.
 */
function withoutCookedWeight(): RecipeSummary {
  const { total } = withCookedWeight.computed;
  const rawGrams = 720;
  const per100g = {
    kcal: ((total.kcal ?? 0) * 100) / rawGrams,
    protein_g: ((total.protein_g ?? 0) * 100) / rawGrams,
    carbs_g: ((total.carbs_g ?? 0) * 100) / rawGrams,
    fat_g: ((total.fat_g ?? 0) * 100) / rawGrams,
    fibre_g: null,
  };

  return {
    ...withCookedWeight,
    yield_grams: null,
    computed: {
      ...withCookedWeight.computed,
      totalGrams: rawGrams,
      effectiveGrams: rawGrams,
      per100g,
    },
  };
}

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

async function openRecipe(recipe: RecipeSummary = withCookedWeight) {
  recipeLogBackend.recipes = [recipe];
  fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
    target: { value: "chicken" },
  });
  const group = await screen.findByRole("region", { name: "Your recipes, values per serving" });
  fireEvent.click(within(group).getByRole("button", { name: /^Chicken\s*and rice/ }));
  await screen.findByRole("button", { name: "Results" });
}

const hero = (caption: string) =>
  screen.getByRole("group", { name: `Energy and macros, ${caption}` });
const amountField = () => screen.getByRole("textbox", { name: /^Amount/ });
const addButton = () => screen.getByRole("button", { name: "Add" });
const unitChip = (name: string) => screen.getByRole("radio", { name });

function typeAmount(text: string) {
  fireEvent.change(amountField(), { target: { value: text } });
}

function chooseTime(hour: string) {
  fireEvent.click(screen.getByRole("button", { name: /^Time \d\d:\d\d$/ }));
  fireEvent.click(
    within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: hour }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
}

const per100 = (heading: string) => screen.getByRole("table", { name: heading });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  resetRecipeLogBackend();
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe("the add food dialog, the amount step of a recipe", () => {
  describe("opening", () => {
    it("should open from a press on the recipe's row, in the same dialog, with a Results link", async () => {
      renderDialog();
      await openRecipe();

      expect(screen.getByRole("dialog", { name: "Add food" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Results" })).toBeTruthy();
      expect(screen.queryByRole("searchbox", { name: "Search foods" })).toBeNull();
    });

    it("should name the recipe, badge it and say what it makes", async () => {
      renderDialog();
      await openRecipe();

      expect(screen.getByText("Recipe")).toBeTruthy();
      expect(screen.getByText("Makes 4 · 1,100 g cooked")).toBeTruthy();
      expect(within(hero("For 1 serving (275 g)")).getByText("Chicken and rice")).toBeTruthy();
    });

    it("should put the cursor in the amount", async () => {
      renderDialog();
      await openRecipe();

      expect(document.activeElement).toBe(amountField());
    });

    it("should go back to the search with what was typed still in it", async () => {
      renderDialog();
      await openRecipe();

      fireEvent.click(screen.getByRole("button", { name: "Results" }));

      expect(screen.getByRole("searchbox", { name: "Search foods" })).toHaveProperty(
        "value",
        "chicken",
      );
      expect(screen.queryByRole("radio", { name: "1 serving" })).toBeNull();
    });
  });

  describe("one serving", () => {
    it("should show 374 kcal for 1 serving (275 g) with the shares of energy", async () => {
      renderDialog();
      await openRecipe();

      const card = hero("For 1 serving (275 g)");

      expect(within(card).getByText("374")).toBeTruthy();
      expect(within(card).getByText("34 %")).toBeTruthy();
      expect(within(card).getByText("45 %")).toBeTruthy();
      expect(within(card).getByText("20 %")).toBeTruthy();
      expect(within(card).getByText("32 g")).toBeTruthy();
      expect(within(card).getByText("43 g")).toBeTruthy();
      expect(within(card).getByText("8.1 g")).toBeTruthy();
      expect(within(card).getByText("Shares of energy are estimates")).toBeTruthy();
    });

    it("should list the values per 100 g of the cooked dish", async () => {
      renderDialog();
      await openRecipe();

      const rows = within(per100("Per 100 g cooked"))
        .getAllByRole("row")
        .map((row) => row.textContent);

      expect(rows).toEqual(["Energy136 kcal", "Protein12 g", "Carbohydrate15 g", "Fat3 g"]);
    });

    it("should start on one serving, with the serving chip chosen and the Time field at the hour asked for", async () => {
      renderDialog();
      await openRecipe();

      expect(amountField()).toHaveProperty("value", "1");
      expect(screen.getByText("serving")).toBeTruthy();
      expect(unitChip("1 serving").getAttribute("aria-checked")).toBe("true");
      expect(unitChip("g").getAttribute("aria-checked")).toBe("false");
      expect(screen.getByRole("button", { name: "Time 18:00" })).toBeTruthy();
    });

    it("should come to 561 kcal for 1.5 servings (413 g), and write the unit as servings", async () => {
      renderDialog();
      await openRecipe();

      typeAmount("1.5");

      expect(within(hero("For 1.5 servings (413 g)")).getByText("561")).toBeTruthy();
      expect(screen.getByText("servings")).toBeTruthy();
    });
  });

  describe("grams", () => {
    it("should start the amount at 100 when g is chosen, and at 1 when the serving is chosen again", async () => {
      renderDialog();
      await openRecipe();
      typeAmount("2");

      fireEvent.click(unitChip("g"));
      expect(amountField()).toHaveProperty("value", "100");
      expect(unitChip("g").getAttribute("aria-checked")).toBe("true");

      fireEvent.click(unitChip("1 serving"));
      expect(amountField()).toHaveProperty("value", "1");
    });

    it("should come to 408 kcal for 300 g, with the same shares", async () => {
      renderDialog();
      await openRecipe();

      fireEvent.click(unitChip("g"));
      typeAmount("300");

      const card = hero("For 300 g");
      expect(within(card).getByText("408")).toBeTruthy();
      expect(within(card).getByText("35 g")).toBeTruthy();
      expect(within(card).getByText("46 g")).toBeTruthy();
      expect(within(card).getByText("8.9 g")).toBeTruthy();
      expect(within(card).getByText("34 %")).toBeTruthy();
      expect(within(card).getByText("45 %")).toBeTruthy();
      expect(within(card).getByText("20 %")).toBeTruthy();
    });

    it("should say nothing about raw grams when the recipe has a cooked weight", async () => {
      renderDialog();
      await openRecipe();

      fireEvent.click(unitChip("g"));

      expect(screen.queryByText(/No cooked weight is set/)).toBeNull();
    });
  });

  describe("a recipe with no cooked weight", () => {
    const rawNote =
      "No cooked weight is set, so these grams are of the raw ingredients (720 g in total).";

    it("should say it makes no cooked weight and list the values per 100 g raw", async () => {
      renderDialog();
      await openRecipe(withoutCookedWeight());

      expect(screen.getByText("Makes 4 · no cooked weight")).toBeTruthy();
      expect(
        within(per100("Per 100 g raw"))
          .getAllByRole("row")
          .map((row) => row.textContent),
      ).toEqual(["Energy208 kcal", "Protein18 g", "Carbohydrate24 g", "Fat4.5 g"]);
    });

    it("should make a serving 180 g and show no raw note while servings are chosen", async () => {
      renderDialog();
      await openRecipe(withoutCookedWeight());

      expect(hero("For 1 serving (180 g)")).toBeTruthy();
      expect(screen.queryByText(rawNote)).toBeNull();
    });

    it("should come to 572 kcal for 275 g, with the raw note as text under the hero", async () => {
      renderDialog();
      await openRecipe(withoutCookedWeight());

      fireEvent.click(unitChip("g"));
      typeAmount("275");

      const card = hero("For 275 g");
      expect(within(card).getByText("572")).toBeTruthy();
      expect(within(card).getByText("48 g")).toBeTruthy();
      expect(within(card).getByText("65 g")).toBeTruthy();
      expect(within(card).getByText("12 g")).toBeTruthy();
      expect(screen.getByText(rawNote)).toBeTruthy();
    });

    it("should keep the raw note readable and have the hero described by it", async () => {
      renderDialog();
      await openRecipe(withoutCookedWeight());
      fireEvent.click(unitChip("g"));
      typeAmount("275");

      const note = screen.getByText(rawNote);

      expect(note.closest("[aria-hidden='true']")).toBeNull();
      expect(hero("For 275 g").getAttribute("aria-describedby")).toBe(note.id);
    });
  });

  describe("an amount that cannot be logged", () => {
    it.each(["", "0", "-1", "abc", "1e308"])(
      "should ask for an amount above 0 and turn Add off for %j",
      async (text) => {
        renderDialog();
        await openRecipe();

        typeAmount(text);

        expect(screen.getByText("Enter an amount above 0.")).toBeTruthy();
        expect(addButton()).toHaveProperty("disabled", true);
        expect(within(hero("For this amount")).getAllByText("–")).toHaveLength(4);
      },
    );

    it("should log nothing when Add is pressed", async () => {
      renderDialog();
      await openRecipe();
      typeAmount("0");

      fireEvent.click(addButton());

      await waitFor(() => {
        expect(addButton()).toHaveProperty("disabled", true);
      });
      expect(recipeLogBackend.inserts).toEqual([]);
    });
  });

  describe("the hero and the stored entry", () => {
    it.each([
      { name: "1.5 servings", unit: "serving", text: "1.5", quantity: 1.5 },
      { name: "300 g", unit: "g", text: "300", quantity: 300 },
    ] as const)(
      "should show for $name what the logged entry stores, to the digit",
      async ({ unit, text, quantity }) => {
        renderDialog();
        await openRecipe();
        fireEvent.click(unitChip(unit === "g" ? "g" : "1 serving"));
        typeAmount(text);
        const expected = buildRecipeLogEntry({
          recipe: withCookedWeight,
          quantity,
          unit,
          loggedAt: "2026-10-15T18:00:00.000Z",
          localDate: "2026-10-15",
        });
        const caption = unit === "g" ? "For 300 g" : "For 1.5 servings (413 g)";

        const card = hero(caption);
        expect(within(card).getByText(formatCalories(expected.nutrients.kcal ?? 0))).toBeTruthy();
        expect(
          within(card).getByText(`${formatGrams(expected.nutrients.protein_g ?? 0)} g`),
        ).toBeTruthy();
        expect(
          within(card).getByText(`${formatGrams(expected.nutrients.carbs_g ?? 0)} g`),
        ).toBeTruthy();
        expect(
          within(card).getByText(`${formatGrams(expected.nutrients.fat_g ?? 0)} g`),
        ).toBeTruthy();

        fireEvent.click(addButton());
        await waitFor(() => {
          expect(recipeLogBackend.inserts).toHaveLength(1);
        });
        expect(recipeLogBackend.inserts[0]).toMatchObject({
          nutrients: expected.nutrients,
          resolved_grams: expected.resolved_grams,
        });
      },
    );
  });

  describe("Add", () => {
    it("should log one serving at the hour asked for, close the dialog and say Added", async () => {
      const { onClose } = renderDialog();
      await openRecipe();

      fireEvent.click(addButton());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(recipeLogBackend.inserts).toHaveLength(1);
      expect(recipeLogBackend.inserts[0]).toMatchObject({
        item_type: "recipe",
        recipe_id: withCookedWeight.id,
        quantity: 1,
        unit: "serving",
        local_date: "2026-10-15",
        logged_at: "2026-10-15T18:00:00.000Z",
      });
      expect(await screen.findByText("Added")).toBeTruthy();
    });

    it("should log 300 g of cooked weight", async () => {
      const { onClose } = renderDialog();
      await openRecipe();
      fireEvent.click(unitChip("g"));
      typeAmount("300");

      fireEvent.click(addButton());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(recipeLogBackend.inserts).toHaveLength(1);
      expect(recipeLogBackend.inserts[0]).toMatchObject({ quantity: 300, unit: "g" });
    });

    it("should log at the time chosen in the Time field", async () => {
      renderDialog();
      await openRecipe();
      chooseTime("19");

      fireEvent.click(addButton());

      await waitFor(() => {
        expect(recipeLogBackend.inserts).toHaveLength(1);
      });
      expect(recipeLogBackend.inserts[0]).toMatchObject({
        logged_at: "2026-10-15T19:00:00.000Z",
        local_date: "2026-10-15",
      });
    });

    it("should log at the moment the dialog opened when no hour was asked for", async () => {
      renderDialog({ date: "2026-10-15" });
      await openRecipe();

      expect(screen.getByText("Now")).toBeTruthy();
      fireEvent.click(addButton());

      await waitFor(() => {
        expect(recipeLogBackend.inserts).toHaveLength(1);
      });
      expect(recipeLogBackend.inserts[0]).toMatchObject({
        logged_at: "2026-10-15T12:40:30.000Z",
      });
    });

    it("should log a double press once", async () => {
      const release = holdInserts();
      const { onClose } = renderDialog();
      await openRecipe();

      const add = addButton();
      fireEvent.click(add);
      fireEvent.click(add);
      release();

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(recipeLogBackend.inserts).toHaveLength(1);
    });

    it("should stay open with the banner, and keep what was typed, when the log fails", async () => {
      recipeLogBackend.failsInsert = true;
      const { onClose } = renderDialog();
      await openRecipe();
      fireEvent.click(unitChip("g"));
      typeAmount("300");

      fireEvent.click(addButton());

      expect(await screen.findByText(SAVE_FAILED_BANNER)).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
      expect(amountField()).toHaveProperty("value", "300");
      expect(screen.queryByText(/RAW/)).toBeNull();
      expect(screen.queryByText("Added")).toBeNull();
    });

    it("should be off when there is no connection, and log nothing for a press or the keyboard", async () => {
      const { onClose } = renderDialog();
      await openRecipe();

      await waitFor(() => {
        onlineManager.setOnline(false);
        expect(addButton()).toHaveProperty("disabled", true);
      });
      fireEvent.click(addButton());
      fireEvent.keyDown(addButton(), { key: "Enter" });
      fireEvent.keyUp(addButton(), { key: " " });

      expect(recipeLogBackend.inserts).toEqual([]);
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
