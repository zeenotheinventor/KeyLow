import {
  DISCARD_SHEET,
  FOOD_FORM,
  GENERIC_ERROR,
  OFFLINE_BANNER,
  RECIPE_EDITOR,
  RECIPE_NOT_FOUND,
  RECIPE_PROBLEMS,
  RECIPE_TOASTS,
  RETRY_LABEL,
  SAVE_FAILED_BANNER,
} from "@keylow/core/copy";
import { newRecipeDraft } from "@keylow/core/recipes";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEditorExisting } from "@/components/recipes";
import type { RecipeState } from "@keylow/api-client";
import type { RecipeDraft } from "@keylow/core/recipes";

import { RecipeEditor, RecipeEditorScreen } from "@/components/recipes";
import { ToastProvider } from "@/components/ui/Toast";
import { editRecipePath, recipePath, recipesPath } from "@/lib/recipeRoutes";

const { recipeState, useRecipe, createRecipe, updateRecipe, router, startingDraft } = vi.hoisted(
  () => {
    const holder = <Value,>(value: Value): { current: Value } => ({ current: value });

    return {
      recipeState: holder<RecipeState>({ status: "loading" }),
      useRecipe: vi.fn<(id: string | undefined) => RecipeState>(),
      createRecipe: vi.fn(),
      updateRecipe: vi.fn(),
      router: { push: vi.fn(), replace: vi.fn() },
      // A test that stands in for the ingredients the next ticket adds gives the new recipe some.
      startingDraft: holder<RecipeDraft | undefined>(undefined),
    };
  },
);

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useRecipe,
  useCreateRecipe: () => ({ mutateAsync: createRecipe }),
  useUpdateRecipe: () => ({ mutateAsync: updateRecipe }),
}));

vi.mock("@keylow/core/recipes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@keylow/core/recipes")>();

  return {
    ...actual,
    newRecipeDraft: (name?: string) => startingDraft.current ?? actual.newRecipeDraft(name),
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => router }));

const RECIPE_ID = "55555555-5555-4555-8555-555555555555";

const golden = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });

const chickenAndRice: RecipeEditorExisting = {
  id: RECIPE_ID,
  name: "Chicken and rice",
  servings: golden.servings,
  yield_grams: golden.yieldGrams,
  instructions: ["Cook the rice.", "Fry the chicken."],
  ingredients: golden.ingredients,
};

function showEditor(props: { existing?: RecipeEditorExisting; initialName?: string } = {}) {
  render(
    <ToastProvider>
      <RecipeEditor {...props} />
    </ToastProvider>,
  );
}

// What `useRecipe` gives for a recipe that has loaded: the stored rows, in order, with their cache.
function readyState(recipe: RecipeEditorExisting): RecipeState {
  return {
    status: "ready",
    recipe: {
      ...recipe,
      ingredients: recipe.ingredients.map((ingredient, position) => ({ ...ingredient, position })),
      is_archived: false,
      computed: {
        total: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 },
        perServing: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 },
        per100g: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 },
        totalGrams: 720,
        effectiveGrams: 1100,
        engineVersion: 1,
      },
    },
  };
}

function showScreen(id = RECIPE_ID) {
  const queryClient = new QueryClient();
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  // A new element each time, or React would find nothing to draw again.
  const screenTree = () => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RecipeEditorScreen id={id} />
      </ToastProvider>
    </QueryClientProvider>
  );
  const { rerender } = render(screenTree());

  return {
    invalidateQueries,
    showAgain: () => {
      rerender(screenTree());
    },
  };
}

const nameField = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Name" });
const servingsField = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Servings" });
const cookedWeightField = () =>
  screen.getByRole<HTMLInputElement>("textbox", { name: RECIPE_EDITOR.cookedWeightName });
const saveButton = () => screen.getByRole("button", { name: "Save" });
const cancelButton = () => screen.getByRole("button", { name: "Cancel" });
const card = () => screen.getByRole("region", { name: "Per serving" });

function type(field: HTMLElement, text: string) {
  fireEvent.change(field, { target: { value: text } });
}

beforeEach(() => {
  vi.resetAllMocks();
  startingDraft.current = undefined;
  recipeState.current = { status: "loading" };
  useRecipe.mockImplementation(() => recipeState.current);
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("RecipeEditor", () => {
  describe("a saved recipe", () => {
    it("should head the page with the recipe's name and put the same name on the way back to it", () => {
      showEditor({ existing: chickenAndRice });

      expect(screen.getByRole("heading", { level: 1, name: "Chicken and rice" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Chicken and rice" }).getAttribute("href")).toBe(
        recipePath(RECIPE_ID),
      );
    });

    it("should show the recipe's name, servings and cooked weight, with the helper naming the raw total", () => {
      showEditor({ existing: chickenAndRice });

      expect(nameField().value).toBe("Chicken and rice");
      expect(servingsField().value).toBe("4");
      expect(cookedWeightField().value).toBe("1100");
      expect(
        screen.getByText(
          "The whole dish once cooked. Leave it blank and per 100 g uses the raw total (720 g).",
        ),
      ).toBeTruthy();
    });

    it("should list the ingredients with the amount and what it comes to", () => {
      showEditor({ existing: chickenAndRice });
      const table = screen.getByRole("table", { name: "Ingredients" });

      expect(screen.getByRole("heading", { name: /^Ingredients/ }).textContent).toBe(
        "Ingredients · 3",
      );
      expect(
        within(table)
          .getAllByRole("row")
          .slice(1)
          .map((row) =>
            within(row)
              .getAllByRole("cell")
              .map((cell) => cell.textContent)
              .slice(0, 2),
          ),
      ).toEqual([
        ["Chicken breast", "500 g"],
        ["Dry rice", "200 g"],
        ["Olive oil", "20 g"],
      ]);
    });

    it("should have no action buttons: refresh, duplicate and archive are the view's", () => {
      showEditor({ existing: chickenAndRice });

      for (const name of ["Refresh ingredients", "Duplicate", "Archive"]) {
        expect(screen.queryByRole("button", { name })).toBeNull();
      }
    });
  });

  describe("the Per serving card", () => {
    it("should show 374 kcal and 32 g of protein for 275 g, and 136 kcal per 100 g cooked, for 4 servings of 1100 g", () => {
      showEditor({ existing: chickenAndRice });

      expect(within(card()).getByText("374")).toBeTruthy();
      expect(within(card()).getByText("Per serving (275 g)")).toBeTruthy();
      expect(within(card()).getByText("32 g")).toBeTruthy();
      expect(within(card()).getByText("Per 100 g cooked: 136 kcal")).toBeTruthy();
    });

    it("should follow a blank cooked weight to 180 g a serving and 208 kcal per 100 g raw", async () => {
      showEditor({ existing: chickenAndRice });

      type(cookedWeightField(), "");

      await waitFor(() => {
        expect(within(card()).getByText("Per serving (180 g)")).toBeTruthy();
      });
      expect(within(card()).getByText("374")).toBeTruthy();
      expect(within(card()).getByText("Per 100 g raw: 208 kcal")).toBeTruthy();
    });

    it("should follow 5 servings to 299 kcal and 220 g a serving", async () => {
      showEditor({ existing: chickenAndRice });

      type(servingsField(), "5");

      await waitFor(() => {
        expect(within(card()).getByText("299")).toBeTruthy();
      });
      expect(within(card()).getByText("Per serving (220 g)")).toBeTruthy();
    });

    it("should wait until typing has stopped, then say the values politely", async () => {
      showEditor({ existing: chickenAndRice });
      expect(within(card()).getByRole("status").textContent).toBe(
        "374 kilocalories per serving, protein 32 grams, carbohydrate 39 grams, fat 8 grams",
      );

      type(servingsField(), "5");
      expect(within(card()).getByText("374")).toBeTruthy();

      await waitFor(() => {
        expect(within(card()).getByRole("status").textContent).toMatch(/^299 kilocalories/);
      });
    });

    it("should show dashes and the plain caption for a new recipe with nothing in it", () => {
      showEditor();

      expect(within(card()).getAllByText("–")).toHaveLength(4);
      expect(within(card()).getByText("Per serving")).toBeTruthy();
      expect(within(card()).queryByText(/Per 100 g/)).toBeNull();
    });

    it("should write the servings suffix in the singular for one", () => {
      showEditor();

      expect(servingsField().value).toBe("1");
      expect(screen.getByText("serving")).toBeTruthy();
    });
  });

  describe("a new recipe", () => {
    it("should head the page New recipe, with Recipes as the way back", () => {
      showEditor();

      expect(screen.getByRole("heading", { level: 1, name: "New recipe" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Recipes" }).getAttribute("href")).toBe(
        recipesPath(),
      );
    });

    it("should say there are no ingredients yet and offer the name field its placeholder", () => {
      showEditor();

      expect(screen.getByText(RECIPE_EDITOR.ingredientsEmpty)).toBeTruthy();
      expect(nameField().getAttribute("placeholder")).toBe("e.g. Veggie chilli");
    });

    it("should start with the name the library passes", () => {
      showEditor({ initialName: "pasta" });

      expect(nameField().value).toBe("pasta");
    });

    it("should not count the passed name as a change", () => {
      showEditor({ initialName: "pasta" });

      fireEvent.click(cancelButton());

      expect(router.push).toHaveBeenCalledWith(recipesPath());
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("pressing Save with problems", () => {
    function pressSaveOnAnEmptyRecipe() {
      showEditor();
      type(servingsField(), "0");
      type(cookedWeightField(), "-5");
      fireEvent.click(saveButton());
    }

    it("should show the summary and all four sentences at once", () => {
      pressSaveOnAnEmptyRecipe();

      expect(screen.getByText(FOOD_FORM.validationSummary)).toBeTruthy();
      expect(screen.getByText("Name is required")).toBeTruthy();
      expect(screen.getByText(RECIPE_PROBLEMS.servings)).toBeTruthy();
      expect(screen.getByText(RECIPE_PROBLEMS.cookedWeight)).toBeTruthy();
      expect(screen.getByText(RECIPE_PROBLEMS.noIngredient)).toBeTruthy();
      expect(createRecipe).not.toHaveBeenCalled();
    });

    it("should leave Save pressable and move focus to the first problem", () => {
      pressSaveOnAnEmptyRecipe();

      expect(saveButton().hasAttribute("disabled")).toBe(false);
      expect(document.activeElement).toBe(nameField());
    });

    it("should clear each sentence as its field is put right", () => {
      pressSaveOnAnEmptyRecipe();

      type(nameField(), "Veggie chilli");
      expect(screen.queryByText("Name is required")).toBeNull();
      expect(screen.getByText(RECIPE_PROBLEMS.servings)).toBeTruthy();

      type(servingsField(), "4");
      expect(screen.queryByText(RECIPE_PROBLEMS.servings)).toBeNull();
      expect(screen.getByText(RECIPE_PROBLEMS.cookedWeight)).toBeTruthy();

      type(cookedWeightField(), "");
      expect(screen.queryByText(RECIPE_PROBLEMS.cookedWeight)).toBeNull();
      expect(screen.getByText(RECIPE_PROBLEMS.noIngredient)).toBeTruthy();
      expect(screen.getByText(FOOD_FORM.validationSummary)).toBeTruthy();
    });

    it("should say nothing before Save is pressed", () => {
      showEditor();

      type(servingsField(), "0");

      expect(screen.queryByText(RECIPE_PROBLEMS.servings)).toBeNull();
      expect(screen.queryByText(FOOD_FORM.validationSummary)).toBeNull();
    });

    it("should move focus to the servings when the name is fine and the servings are not", () => {
      showEditor({ initialName: "Veggie chilli" });
      type(servingsField(), "0");

      fireEvent.click(saveButton());

      expect(document.activeElement).toBe(servingsField());
    });

    it("should move focus to the ingredients when they are the only problem", () => {
      showEditor({ initialName: "Veggie chilli" });

      fireEvent.click(saveButton());

      expect(document.activeElement).toBe(screen.getByRole("region", { name: /^Ingredients/ }));
    });
  });

  describe("saving", () => {
    function savedFrom(save: {
      id: string;
      name: string;
      servings: number;
      yieldGrams: number | null;
      steps: string[];
      ingredients: RecipeEditorExisting["ingredients"];
    }): RecipeEditorExisting {
      return {
        id: save.id,
        name: save.name,
        servings: save.servings,
        yield_grams: save.yieldGrams,
        instructions: save.steps,
        ingredients: save.ingredients,
      };
    }

    it("should save the change once, go to the recipe's path and say Recipe saved", async () => {
      updateRecipe.mockImplementation((save: Parameters<typeof savedFrom>[0]) =>
        Promise.resolve(savedFrom(save)),
      );
      showEditor({ existing: chickenAndRice });

      type(nameField(), "  Chicken and rice, again ");
      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith(recipePath(RECIPE_ID));
      });
      expect(updateRecipe).toHaveBeenCalledOnce();
      expect(updateRecipe).toHaveBeenCalledWith({
        id: RECIPE_ID,
        name: "Chicken and rice, again",
        servings: 4,
        yieldGrams: 1100,
        steps: ["Cook the rice.", "Fry the chicken."],
        ingredients: chickenAndRice.ingredients,
      });
      expect(createRecipe).not.toHaveBeenCalled();
      expect(screen.getByText(RECIPE_TOASTS.saved)).toBeTruthy();
    });

    it("should read the saved recipe back as the new starting point, so leaving it asks nothing", async () => {
      updateRecipe.mockImplementation((save: Parameters<typeof savedFrom>[0]) =>
        Promise.resolve(savedFrom(save)),
      );
      showEditor({ existing: chickenAndRice });
      type(nameField(), "Chicken and rice, again");
      fireEvent.click(saveButton());
      await waitFor(() => {
        expect(router.replace).toHaveBeenCalled();
      });

      expect(
        screen.getByRole("heading", { level: 1, name: "Chicken and rice, again" }),
      ).toBeTruthy();
      fireEvent.click(cancelButton());
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(router.push).toHaveBeenCalledWith(recipePath(RECIPE_ID));
    });

    it("should create a new recipe once it has an ingredient, and open the new recipe's path", async () => {
      startingDraft.current = {
        ...newRecipeDraft(),
        name: "Chicken and rice",
        ingredients: golden.ingredients,
      };
      createRecipe.mockImplementation((save: Parameters<typeof savedFrom>[0]) =>
        Promise.resolve(savedFrom({ ...save, id: RECIPE_ID })),
      );
      showEditor();

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith(recipePath(RECIPE_ID));
      });
      expect(createRecipe).toHaveBeenCalledOnce();
      expect(updateRecipe).not.toHaveBeenCalled();
      expect(screen.getByText(RECIPE_TOASTS.saved)).toBeTruthy();
    });

    it("should make one request for a double press, and lock the fields while it waits", () => {
      updateRecipe.mockReturnValue(new Promise(() => undefined));
      showEditor({ existing: chickenAndRice });
      type(nameField(), "Chicken and rice, again");

      const save = saveButton();
      fireEvent.click(save);
      fireEvent.click(save);

      expect(updateRecipe).toHaveBeenCalledOnce();
      expect(nameField().hasAttribute("readonly")).toBe(true);
      expect(servingsField().hasAttribute("readonly")).toBe(true);
      expect(cookedWeightField().hasAttribute("readonly")).toBe(true);
      expect(screen.getByRole("button", { name: FOOD_FORM.saving }).getAttribute("aria-busy")).toBe(
        "true",
      );
    });

    it("should say the recipe was not saved, keep everything typed and let Save be pressed again", async () => {
      updateRecipe.mockRejectedValueOnce(new Error("Could not save the recipe (XX000)"));
      showEditor({ existing: chickenAndRice });
      type(nameField(), "Chicken and rice, again");
      type(servingsField(), "6");

      fireEvent.click(saveButton());

      expect(await screen.findByText(SAVE_FAILED_BANNER)).toBeTruthy();
      expect(screen.queryByText(/XX000/)).toBeNull();
      expect(nameField().value).toBe("Chicken and rice, again");
      expect(servingsField().value).toBe("6");
      expect(nameField().hasAttribute("readonly")).toBe(false);
      expect(saveButton().hasAttribute("disabled")).toBe(false);
      expect(router.replace).not.toHaveBeenCalled();
      expect(screen.queryByText(RECIPE_TOASTS.saved)).toBeNull();
    });
  });

  describe("leaving", () => {
    it("should leave an untouched recipe without asking, by Cancel and by the way back", () => {
      showEditor({ existing: chickenAndRice });

      fireEvent.click(cancelButton());
      const wasNotCancelled = fireEvent.click(
        screen.getByRole("link", { name: "Chicken and rice" }),
      );

      expect(router.push).toHaveBeenCalledWith(recipePath(RECIPE_ID));
      expect(wasNotCancelled).toBe(true);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should ask before Cancel loses a change, with focus on Keep editing", () => {
      showEditor({ existing: chickenAndRice });
      type(servingsField(), "5");

      fireEvent.click(cancelButton());

      const dialog = screen.getByRole("dialog", { name: DISCARD_SHEET.editTitle });
      expect(within(dialog).getByText(DISCARD_SHEET.editBody)).toBeTruthy();
      expect(document.activeElement).toBe(
        within(dialog).getByRole("button", { name: DISCARD_SHEET.keepEditing }),
      );
      expect(router.push).not.toHaveBeenCalled();
    });

    it("should ask before the way back loses a change, and stop the link", () => {
      showEditor({ existing: chickenAndRice });
      type(servingsField(), "5");

      const wasNotCancelled = fireEvent.click(
        screen.getByRole("link", { name: "Chicken and rice" }),
      );

      expect(wasNotCancelled).toBe(false);
      expect(screen.getByRole("dialog", { name: DISCARD_SHEET.editTitle })).toBeTruthy();
    });

    it("should not count a change that is put back", () => {
      showEditor({ existing: chickenAndRice });
      type(servingsField(), "5");
      type(servingsField(), "4.0");

      fireEvent.click(cancelButton());

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should keep the form as it was on Keep editing", () => {
      showEditor({ existing: chickenAndRice });
      type(servingsField(), "5");
      fireEvent.click(cancelButton());

      fireEvent.click(screen.getByRole("button", { name: DISCARD_SHEET.keepEditing }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(servingsField().value).toBe("5");
      expect(router.push).not.toHaveBeenCalled();
    });

    it("should go where it was heading on Discard changes", () => {
      showEditor({ existing: chickenAndRice });
      type(servingsField(), "5");
      fireEvent.click(cancelButton());

      fireEvent.click(screen.getByRole("button", { name: DISCARD_SHEET.discard }));

      expect(router.push).toHaveBeenCalledWith(recipePath(RECIPE_ID));
    });

    it("should put the saved values back on Discard changes, close the dialog and clear what was said", () => {
      showEditor({ existing: chickenAndRice });
      type(nameField(), "Chicken and rice, again");
      type(servingsField(), "0");
      fireEvent.click(saveButton());
      expect(screen.getByText(RECIPE_PROBLEMS.servings)).toBeTruthy();
      fireEvent.click(cancelButton());

      fireEvent.click(screen.getByRole("button", { name: DISCARD_SHEET.discard }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(nameField().value).toBe("Chicken and rice");
      expect(servingsField().value).toBe("4");
      expect(screen.queryByText(RECIPE_PROBLEMS.servings)).toBeNull();
      expect(screen.queryByText(FOOD_FORM.validationSummary)).toBeNull();
    });

    it("should hold focus inside the dialog", () => {
      showEditor({ existing: chickenAndRice });
      type(servingsField(), "5");
      fireEvent.click(cancelButton());
      const dialog = screen.getByRole("dialog");

      within(dialog).getByRole("button", { name: DISCARD_SHEET.discard }).focus();
      fireEvent.keyDown(document, { key: "Tab" });

      expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close" }));
    });

    it("should ask about a new recipe in its own words, and go to the library", () => {
      showEditor();
      type(nameField(), "Veggie chilli");
      fireEvent.click(cancelButton());

      expect(screen.getByRole("dialog", { name: DISCARD_SHEET.newTitle })).toBeTruthy();
      expect(screen.getByText(DISCARD_SHEET.newBody)).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: DISCARD_SHEET.discard }));
      expect(router.push).toHaveBeenCalledWith(recipesPath());
    });

    it("should ask the browser before the tab is closed with a change, and not without one", () => {
      showEditor({ existing: chickenAndRice });
      const closeTab = () => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      };

      expect(closeTab()).toBe(false);

      type(servingsField(), "5");
      expect(closeTab()).toBe(true);
    });
  });

  describe("when the connection drops", () => {
    it("should say so, keep the fields editable and dim Save, which does nothing", () => {
      showEditor({ existing: chickenAndRice });

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByText(OFFLINE_BANNER.title)).toBeTruthy();
      expect(screen.getByText(RECIPE_EDITOR.offlineEditingBody)).toBeTruthy();
      type(nameField(), "Chicken and rice, again");
      expect(nameField().value).toBe("Chicken and rice, again");
      expect(saveButton().getAttribute("aria-disabled")).toBe("true");
      expect(saveButton().className).toContain("opacity-40");

      fireEvent.click(saveButton());
      expect(updateRecipe).not.toHaveBeenCalled();
    });

    it("should still ask before leaving", () => {
      showEditor({ existing: chickenAndRice });
      act(() => {
        onlineManager.setOnline(false);
      });
      type(nameField(), "Chicken and rice, again");

      fireEvent.click(cancelButton());

      expect(screen.getByRole("dialog", { name: DISCARD_SHEET.editTitle })).toBeTruthy();
    });

    it("should leave Save alone while there is a connection", () => {
      showEditor({ existing: chickenAndRice });

      expect(saveButton().getAttribute("aria-disabled")).toBeNull();
      expect(screen.queryByText(OFFLINE_BANNER.title)).toBeNull();
    });
  });
});

describe("RecipeEditorScreen", () => {
  it("should say it is loading under the way back to the library", () => {
    recipeState.current = { status: "loading" };

    showScreen();

    expect(screen.getByRole("status", { name: RECIPE_EDITOR.loadingLabel })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Recipes" }).getAttribute("href")).toBe(recipesPath());
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  });

  it("should draw the skeleton once the first 200 ms have passed", async () => {
    recipeState.current = { status: "loading" };

    showScreen();

    expect(screen.getByRole("status", { name: RECIPE_EDITOR.loadingLabel }).childElementCount).toBe(
      0,
    );
    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: RECIPE_EDITOR.loadingLabel }).childElementCount,
      ).toBeGreaterThan(0);
    });
  });

  it("should say something went wrong, never show the failure, and try again on request", () => {
    recipeState.current = { status: "error", debugMessage: "load the recipe: XX000" };

    const { invalidateQueries } = showScreen();

    expect(screen.getByText(GENERIC_ERROR)).toBeTruthy();
    expect(screen.queryByText(/XX000/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: RETRY_LABEL }));
    expect(invalidateQueries).toHaveBeenCalledOnce();
  });

  it("should say the recipe was not found, with the way back to the library", () => {
    recipeState.current = { status: "notFound" };

    showScreen();

    expect(screen.getByRole("heading", { name: RECIPE_NOT_FOUND.title })).toBeTruthy();
    expect(screen.getByText(RECIPE_NOT_FOUND.body)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Recipes" }).getAttribute("href")).toBe(recipesPath());
  });

  it("should go straight to not found, without asking, for a link that cannot be a recipe", () => {
    showScreen("not-a-recipe");

    expect(screen.getByRole("heading", { name: RECIPE_NOT_FOUND.title })).toBeTruthy();
    expect(useRecipe).toHaveBeenCalledWith(undefined);
    expect(useRecipe).not.toHaveBeenCalledWith("not-a-recipe");
  });

  it("should open the editor on a recipe that has loaded", () => {
    recipeState.current = readyState(chickenAndRice);

    showScreen();

    expect(screen.getByRole("heading", { level: 1, name: "Chicken and rice" })).toBeTruthy();
    expect(editRecipePath(RECIPE_ID)).toBe(recipePath(RECIPE_ID));
  });

  it("should start the editor afresh for another recipe, and not carry what was typed over", () => {
    recipeState.current = readyState(chickenAndRice);
    const { showAgain } = showScreen();
    type(nameField(), "Typed over");

    recipeState.current = readyState({
      ...chickenAndRice,
      id: "66666666-6666-4666-8666-666666666666",
      name: "Frittata",
    });
    showAgain();

    expect(nameField().value).toBe("Frittata");
  });
});
