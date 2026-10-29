import {
  GENERIC_ERROR,
  RETRY_LABEL,
  SHOPPING_LIST,
  SHOPPING_LIST_CLEAR_DIALOG,
  SHOPPING_LIST_EMPTY,
} from "@keylow/core/copy";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "../ui/appRouter";

import type { ShoppingListViewProps } from "@/components/recipes";
import type { ShoppingPreviewState } from "@keylow/api-client";
import type { ShoppingItem } from "@keylow/core/shopping";

import { RecipeLibraryView, ShoppingListScreen, ShoppingListView } from "@/components/recipes";
import { RecipeViewActions } from "@/components/recipes/RecipeViewActions";
import { sampleRecipes } from "@/components/recipes/sampleRecipes";
import { ToastProvider } from "@/components/ui/Toast";

const CHILLI_ID = "11111111-1111-4111-8111-111111111111";
const ONION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SALT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const itemOf = (serial: number, overrides: Partial<ShoppingItem>): ShoppingItem => ({
  id: `77777777-7777-4777-8777-${String(serial).padStart(12, "0")}`,
  food_id: null,
  name: "Bin bags",
  grams: null,
  portion_label: null,
  portion_count: null,
  sources: [],
  position: serial,
  checked_at: null,
  ...overrides,
});

const onions = itemOf(1, {
  food_id: ONION_ID,
  name: "Onions",
  grams: 300,
  portion_label: "1 medium",
  portion_count: 2,
  sources: [{ recipeId: CHILLI_ID, name: "Chilli" }],
});
const binBags = itemOf(2, {});
const milk = itemOf(0, { name: "Milk", checked_at: "2026-10-29T09:00:00Z" });

// What the mocked hooks return and what they were asked to do, set by each test.
type MockedList = {
  data: ShoppingItem[] | undefined;
  isError: boolean;
  refetch: () => Promise<void>;
};

const api = vi.hoisted(() => {
  const state: { list: MockedList; preview: ShoppingPreviewState; previewCalls: unknown[] } = {
    list: { data: undefined, isError: false, refetch: () => Promise.resolve() },
    preview: { status: "loading" },
    previewCalls: [],
  };

  return {
    ...state,
    toggle: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    addItem: vi.fn(),
    addRecipes: vi.fn(),
  };
});

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useShoppingList: () => api.list,
  useToggleShoppingItem: () => ({ mutate: api.toggle, isPending: false }),
  useRemoveShoppingItem: () => ({ mutate: api.remove, isPending: false }),
  useClearTickedItems: () => ({ mutate: api.clear, isPending: false }),
  useAddShoppingItem: () => ({ mutate: api.addItem, isPending: false }),
  useAddRecipesToList: () => ({ mutate: api.addRecipes, isPending: false }),
  useRecipes: () => ({ data: sampleRecipes, isError: false, refetch: () => Promise.resolve() }),
  useShoppingPreview: (recipes: unknown) => {
    api.previewCalls.push(recipes);
    return api.preview;
  },
}));

beforeEach(() => {
  api.list = { data: [onions, binBags, milk], isError: false, refetch: () => Promise.resolve() };
  api.preview = { status: "loading" };
  api.previewCalls = [];
  for (const mock of [api.toggle, api.remove, api.clear, api.addItem, api.addRecipes]) {
    mock.mockReset();
  }
});

afterEach(() => {
  cleanup();
});

type ReadyProps = Extract<ShoppingListViewProps, { status: "ready" }>;

function renderReady(overrides: Partial<ReadyProps> = {}) {
  const props: ReadyProps = {
    status: "ready",
    items: [onions, binBags, milk],
    isOnline: true,
    isAddingItem: false,
    isClearing: false,
    onToggle: vi.fn(),
    onRemove: vi.fn(),
    onAddItem: vi.fn(),
    onAddRecipe: vi.fn(),
    onClearTicked: vi.fn(),
    ...overrides,
  };
  renderWithRouter(<ShoppingListView {...props} />);
  return props;
}

describe("ShoppingListView", () => {
  it("should be titled Shopping list with a way back to Recipes", () => {
    renderReady();

    expect(screen.getByRole("heading", { level: 1, name: SHOPPING_LIST.title })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Recipes" }).getAttribute("href")).toBe("/recipes");
  });

  it("should list what is to buy, then what is ticked, each in list order", () => {
    renderReady();

    const toBuy = screen.getByRole("region", { name: SHOPPING_LIST.toBuy });
    const ticked = screen.getByRole("region", { name: SHOPPING_LIST.ticked });
    expect(
      within(toBuy)
        .getAllByRole("checkbox")
        .map((box) => [
          box.getAttribute("aria-label") ?? box.closest("label")?.textContent,
          (box as HTMLInputElement).checked,
        ]),
    ).toEqual([
      ["Onions", false],
      ["Bin bags", false],
    ]);
    expect(within(ticked).getByRole<HTMLInputElement>("checkbox", { name: "Milk" }).checked).toBe(
      true,
    );
  });

  it("should describe an item by its amount and the recipes it came from", () => {
    renderReady();

    expect(
      screen.getByRole("checkbox", { name: "Onions" }).getAttribute("aria-describedby"),
    ).not.toBeNull();
    expect(screen.getByText("2 × 1 medium · 300 g · From Chilli")).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "Bin bags" }).hasAttribute("aria-describedby"),
    ).toBe(false);
  });

  it("should tick, untick and remove an item through its own controls", () => {
    const props = renderReady();

    fireEvent.click(screen.getByRole("checkbox", { name: "Onions" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Milk" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Bin bags" }));

    expect(props.onToggle).toHaveBeenNthCalledWith(1, onions, true);
    expect(props.onToggle).toHaveBeenNthCalledWith(2, milk, false);
    expect(props.onRemove).toHaveBeenCalledWith(binBags);
  });

  it("should add the typed words and empty the field once they are on the list", () => {
    const props = renderReady({
      onAddItem: vi.fn((_text: string, onAdded: () => void) => {
        onAdded();
      }),
    });
    const field = screen.getByRole("textbox", { name: SHOPPING_LIST.addItemPlaceholder });

    fireEvent.change(field, { target: { value: "Kitchen roll" } });
    fireEvent.click(screen.getByRole("button", { name: SHOPPING_LIST.addItem }));

    expect(props.onAddItem).toHaveBeenCalledWith("Kitchen roll", expect.any(Function));
    expect((field as HTMLInputElement).value).toBe("");
  });

  it("should offer Add a recipe and Clear ticked items", () => {
    const props = renderReady();

    fireEvent.click(screen.getByRole("button", { name: SHOPPING_LIST.addRecipe }));
    fireEvent.click(screen.getByRole("button", { name: SHOPPING_LIST.clearTicked }));

    expect(props.onAddRecipe).toHaveBeenCalledTimes(1);
    expect(props.onClearTicked).toHaveBeenCalledTimes(1);
  });

  it("should leave out Clear ticked items when nothing is ticked", () => {
    renderReady({ items: [onions] });

    expect(screen.queryByRole("region", { name: SHOPPING_LIST.ticked })).toBeNull();
    expect(screen.queryByRole("button", { name: SHOPPING_LIST.clearTicked })).toBeNull();
  });

  it("should say the list is empty when nothing is on it", () => {
    renderReady({ items: [] });

    expect(screen.getByRole("heading", { name: SHOPPING_LIST_EMPTY.title })).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("should disable every control offline and say why", () => {
    renderReady({ isOnline: false });

    expect(screen.getByText(SHOPPING_LIST.offlineBody)).toBeTruthy();
    for (const control of [
      screen.getByRole("checkbox", { name: "Onions" }),
      screen.getByRole("button", { name: "Remove Onions" }),
      screen.getByRole("button", { name: SHOPPING_LIST.addRecipe }),
      screen.getByRole("button", { name: SHOPPING_LIST.addItem }),
      screen.getByRole("button", { name: SHOPPING_LIST.clearTicked }),
    ]) {
      expect((control as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("should offer Try again when the list did not load", () => {
    const onRetry = vi.fn();
    renderWithRouter(<ShoppingListView status="error" onRetry={onRetry} />);

    expect(screen.getByRole("heading", { name: GENERIC_ERROR })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: RETRY_LABEL }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

function renderScreen() {
  renderWithRouter(
    <ToastProvider>
      <ShoppingListScreen />
    </ToastProvider>,
  );
}

describe("ShoppingListScreen", () => {
  it("should tick an item and say so when the change fails", async () => {
    api.toggle.mockImplementation((_input: unknown, options: { onError: () => void }) => {
      options.onError();
    });
    renderScreen();

    fireEvent.click(screen.getByRole("checkbox", { name: "Onions" }));

    expect(api.toggle).toHaveBeenCalledWith(
      { id: onions.id, checked: true },
      expect.objectContaining({ onError: expect.any(Function) as unknown }),
    );
    expect(await screen.findByText(SHOPPING_LIST.changeFailed)).toBeTruthy();
  });

  it("should remove an item by its id", () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Remove Onions" }));

    expect(api.remove).toHaveBeenCalledWith(onions.id, expect.anything());
  });

  it("should ask before clearing the ticked items, and keep them on Keep them", async () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: SHOPPING_LIST.clearTicked }));
    const dialog = await screen.findByRole("dialog", { name: SHOPPING_LIST_CLEAR_DIALOG.title });
    fireEvent.click(
      within(dialog).getByRole("button", { name: SHOPPING_LIST_CLEAR_DIALOG.cancelLabel }),
    );

    expect(api.clear).not.toHaveBeenCalled();
  });

  it("should clear the ticked items once that is confirmed", async () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: SHOPPING_LIST.clearTicked }));
    const dialog = await screen.findByRole("dialog", { name: SHOPPING_LIST_CLEAR_DIALOG.title });
    fireEvent.click(
      within(dialog).getByRole("button", { name: SHOPPING_LIST_CLEAR_DIALOG.confirmLabel }),
    );

    expect(api.clear).toHaveBeenCalledTimes(1);
  });

  it("should open the add dialog for the recipe chosen, at its saved servings", async () => {
    const [recipe] = sampleRecipes;
    if (recipe === undefined) {
      throw new Error("The sample recipes are empty");
    }
    api.preview = {
      status: "ready",
      preview: {
        items: [
          {
            foodId: ONION_ID,
            name: "Onions",
            grams: 300,
            portionLabel: "1 medium",
            portionCount: 2,
            sources: [{ recipeId: recipe.id, name: recipe.name }],
            rule: "default",
          },
        ],
        staples: [
          {
            foodId: SALT_ID,
            name: "Salt",
            grams: 5,
            portionLabel: null,
            portionCount: null,
            sources: [{ recipeId: recipe.id, name: recipe.name }],
            rule: "food_group",
          },
        ],
      },
    };
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: SHOPPING_LIST.addRecipe }));
    const picker = await screen.findByRole("dialog", { name: SHOPPING_LIST.chooseRecipe });
    fireEvent.click(within(picker).getByRole("button", { name: recipe.name }));

    const dialog = await screen.findByRole("dialog", { name: SHOPPING_LIST.addToList });
    expect(api.previewCalls.at(-1)).toEqual([{ id: recipe.id, servings: recipe.servings }]);
    expect(within(dialog).getByText("2 × 1 medium · 300 g")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Add anyway: Salt" }));
    act(() => {
      fireEvent.click(within(dialog).getByRole("button", { name: SHOPPING_LIST.addToList }));
    });

    await waitFor(() => {
      expect(api.addRecipes).toHaveBeenCalledWith(
        { recipes: [{ id: recipe.id, servings: recipe.servings }], addAnyway: [SALT_ID] },
        expect.anything(),
      );
    });
  });
});

describe("the ways to the shopping list", () => {
  it("should lead from the recipe library to the shopping list", () => {
    renderWithRouter(<RecipeLibraryView status="loading" />);

    expect(screen.getByRole("link", { name: SHOPPING_LIST.title }).getAttribute("href")).toBe(
      "/recipes/shopping",
    );
  });

  it("should offer Add to shopping list on a recipe, and do nothing with it offline", () => {
    const onAddToList = vi.fn();
    const props = {
      name: "Chilli",
      editHref: "/recipes/x/edit",
      isArchived: false,
      isLibraryRead: true,
      isDuplicating: false,
      isArchiving: false,
      onRefresh: vi.fn(),
      onAddToList,
      onDuplicate: vi.fn(),
      onArchive: vi.fn(),
    };
    renderWithRouter(<RecipeViewActions {...props} isOnline />);

    fireEvent.click(screen.getByRole("button", { name: SHOPPING_LIST.addToList }));
    expect(onAddToList).toHaveBeenCalledTimes(1);

    cleanup();
    renderWithRouter(<RecipeViewActions {...props} isOnline={false} />);
    const offline = screen.getByRole("button", { name: SHOPPING_LIST.addToList });
    fireEvent.click(offline);
    expect(offline.getAttribute("aria-disabled")).toBe("true");
    expect(onAddToList).toHaveBeenCalledTimes(1);
  });
});
