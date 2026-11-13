import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeSearchHit } from "../foods/support";

import type { RecipeEditorExisting } from "@/components/recipes";
import type { FoodSearchHit } from "@keylow/api-client";

import EditRecipePage from "@/app/(dashboard)/recipes/[id]/edit/page";
import { RecipeEditor } from "@/components/recipes";
import { ToastProvider } from "@/components/ui/Toast";

// An assistant card's link opens the editor with Add ingredient already searching for the line's food word.

const api = vi.hoisted((): { hits: FoodSearchHit[]; searches: string[] } => ({
  hits: [],
  searches: [],
}));
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
const { recipeState } = vi.hoisted(() => ({
  recipeState: { current: undefined as RecipeEditorExisting | undefined },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useRefreshOutdatedOffFood: () => undefined,
  useRecentFoods: () => ({ data: [], isError: false, fetchStatus: "idle" }),
  useCreateRecipe: () => ({ mutateAsync: vi.fn() }),
  useUpdateRecipe: () => ({ mutateAsync: vi.fn() }),
  useFoodWithPortions: () => ({ status: "notFound" }),
  useRecipe: () =>
    recipeState.current === undefined
      ? { status: "loading" }
      : { status: "ready", recipe: recipeState.current },
  useFoodSearch: (query: string) => {
    api.searches.push(query);

    return {
      local: query.trim().length >= 2 ? api.hits : [],
      off: [],
      isLoadingLocal: false,
      isLoadingOff: false,
      isDebouncing: false,
      offError: null,
      localError: null,
    };
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));

const RECIPE_ID = "55555555-5555-4555-8555-555555555555";
const golden = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });
const recipe: RecipeEditorExisting = {
  id: RECIPE_ID,
  name: "Chicken and rice",
  servings: golden.servings,
  yield_grams: golden.yieldGrams,
  instructions: [],
  ingredients: golden.ingredients,
};

const searchField = () => screen.getByRole<HTMLInputElement>("searchbox", { name: "Search foods" });
const closeDialog = () => {
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Add ingredient" })).getByRole("button", {
      name: "Cancel",
    }),
  );
};
const addDialog = () => screen.queryByRole("dialog", { name: "Add ingredient" });

afterEach(() => {
  cleanup();
  replace.mockClear();
  api.hits = [];
  api.searches = [];
  recipeState.current = undefined;
});

describe("the editor opened on a word to add", () => {
  it("should open Add ingredient with the search holding the word and its results shown", () => {
    api.hits = [makeSearchHit({ name: "Wine, white" })];

    render(
      <ToastProvider>
        <RecipeEditor existing={recipe} initialIngredientSearch="white wine" />
      </ToastProvider>,
    );

    expect(addDialog()).toBeTruthy();
    expect(searchField().value).toBe("white wine");
    const rows = within(screen.getByRole("group", { name: "Search results" })).getAllByRole(
      "listitem",
    );
    expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining("Wine, white")]);
  });

  it("should leave the editor alone when the dialog is closed, and not open it again", () => {
    const { rerender } = render(
      <ToastProvider>
        <RecipeEditor existing={recipe} initialIngredientSearch="wine" />
      </ToastProvider>,
    );

    closeDialog();
    rerender(
      <ToastProvider>
        <RecipeEditor existing={recipe} initialIngredientSearch="wine" />
      </ToastProvider>,
    );

    expect(addDialog()).toBeNull();
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  });

  it("should open the Add ingredient button's own search empty after the word's search was closed", () => {
    render(
      <ToastProvider>
        <RecipeEditor existing={recipe} initialIngredientSearch="wine" />
      </ToastProvider>,
    );
    closeDialog();

    fireEvent.click(screen.getByRole("button", { name: "Add ingredient" }));

    expect(searchField().value).toBe("");
  });

  it("should open on the editor alone when there is no word", () => {
    render(
      <ToastProvider>
        <RecipeEditor existing={recipe} />
      </ToastProvider>,
    );

    expect(addDialog()).toBeNull();
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  });
});

describe("taking the word out of the address", () => {
  const editorOnTheWord = () =>
    render(
      <ToastProvider>
        <RecipeEditor existing={recipe} initialIngredientSearch="wine" />
      </ToastProvider>,
    );

  it("should replace the address with the plain editor once when the search is cancelled", () => {
    editorOnTheWord();
    expect(replace).not.toHaveBeenCalled();

    closeDialog();

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(`/recipes/${RECIPE_ID}/edit`);
  });

  it("should replace the address when Escape closes the search", () => {
    editorOnTheWord();

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Add ingredient" }), { key: "Escape" });

    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("should leave the address alone when the Add ingredient button's dialog closes", () => {
    render(
      <ToastProvider>
        <RecipeEditor existing={recipe} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add ingredient" }));

    closeDialog();

    expect(replace).not.toHaveBeenCalled();
  });
});

describe("the edit page", () => {
  async function showPage(addIngredient?: string | string[]) {
    recipeState.current = recipe;
    const page = await EditRecipePage({
      params: Promise.resolve({ id: RECIPE_ID }),
      searchParams: Promise.resolve(addIngredient === undefined ? {} : { addIngredient }),
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>{page}</ToastProvider>
      </QueryClientProvider>,
    );
  }

  it("should open Add ingredient on the word in the address", async () => {
    await showPage("wine");

    expect(addDialog()).toBeTruthy();
    expect(searchField().value).toBe("wine");
  });

  it("should use the first word when the parameter is repeated", async () => {
    await showPage(["wine", "stock"]);

    expect(searchField().value).toBe("wine");
  });

  it("should open the editor alone when the address has no word", async () => {
    await showPage();

    expect(addDialog()).toBeNull();
  });
});
