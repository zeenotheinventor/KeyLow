import { RECIPE_EDITOR, RECIPE_PROBLEMS } from "@keylow/core/copy";
import { buildBucketAndFriesRecipe } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEditorExisting } from "@/components/recipes";
import type { RecipeState } from "@keylow/api-client";
import type { RecipeDraft } from "@keylow/core/recipes";

import { RecipeEditor } from "@/components/recipes";
import { ToastProvider } from "@/components/ui/Toast";

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

const mealDeal = buildBucketAndFriesRecipe({ servings: 4 });

const servingsOnlyRecipe: RecipeEditorExisting = {
  id: RECIPE_ID,
  name: "Meal deal",
  servings: mealDeal.servings,
  yield_grams: null,
  instructions: [],
  ingredients: mealDeal.ingredients,
};

function showEditor(props: { existing?: RecipeEditorExisting } = {}) {
  render(
    <ToastProvider>
      <RecipeEditor {...props} />
    </ToastProvider>,
  );
}

const cookedWeightFields = () =>
  screen.queryAllByRole("textbox", { name: RECIPE_EDITOR.cookedWeightName });
const saveButton = () => screen.getByRole("button", { name: "Save" });
const card = () => screen.getByRole("region", { name: "Per serving" });

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

describe("a recipe with a food counted in portions (ADR 0003, Amendment 19)", () => {
  it("should list the bucket by its portions, with no grams", () => {
    showEditor({ existing: servingsOnlyRecipe });

    expect(screen.getAllByText("1 bucket").length).toBeGreaterThan(0);
    expect(screen.getAllByText("200 g").length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/bucket.*\bg\b/)).toHaveLength(0);
  });

  it("should have no cooked weight field", () => {
    showEditor({ existing: servingsOnlyRecipe });

    expect(cookedWeightFields()).toHaveLength(0);
  });

  it("should caption the card Per serving, with no grams and no values per 100 g", () => {
    showEditor({ existing: servingsOnlyRecipe });

    expect(within(card()).getByText("Per serving")).toBeTruthy();
    expect(within(card()).queryByText(/Per 100 g/)).toBeNull();
  });

  it("should save with no cooked weight", async () => {
    updateRecipe.mockResolvedValue(servingsOnlyRecipe);
    showEditor({ existing: servingsOnlyRecipe });

    fireEvent.click(saveButton());

    await waitFor(() => {
      expect(updateRecipe).toHaveBeenCalledWith(expect.objectContaining({ yieldGrams: null }));
    });
  });

  it("should refuse a cooked weight typed before the bucket was added, and say why on the field", () => {
    showEditor({
      existing: { ...servingsOnlyRecipe, yield_grams: 900 },
    });

    expect(cookedWeightFields()).toHaveLength(1);
    fireEvent.click(saveButton());

    expect(screen.getByText(RECIPE_PROBLEMS.cookedWeightWithRestaurantFood)).toBeTruthy();
    expect(updateRecipe).not.toHaveBeenCalled();
  });
});
