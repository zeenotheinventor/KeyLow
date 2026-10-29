import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import {
  GENERIC_ERROR,
  SHOPPING_LIST,
  SHOPPING_LIST_CLEAR_DIALOG,
  SHOPPING_LIST_EMPTY,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import AddToListRoute from "../../app/recipes/[id]/add-to-list";
import ShoppingListRoute from "../../app/recipes/shopping";
import { sampleRecipes } from "../../components/RecipeLibraryView/sampleRecipes";
import { ToastProvider } from "../../components/ui";
import { addToListPath, recipesPath } from "../../lib/recipeRoutes";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RecipeState, ShoppingPreviewState } from "@keylow/api-client";
import type { ShoppingItem } from "@keylow/core/shopping";
import type { QueryClient } from "@tanstack/react-query";

// The shopping list and the add to list screens, through their routes, with the shopping hooks mocked so a
// test says what the list holds and reads what each control asked for. The hooks themselves are tested in
// @keylow/api-client against a fake database.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("../support/sheetScrollViewMock")
    .mockBottomSheet(),
);
jest.mock("../../lib/useReadsEnabled", () => ({ useReadsEnabled: () => true }));

type MockedList = { data: ShoppingItem[] | undefined; isError: boolean; refetch: () => void };

const mockApi: {
  list: MockedList;
  recipes: typeof sampleRecipes;
  recipe: RecipeState;
  preview: ShoppingPreviewState;
  previewCalls: unknown[];
  toggle: jest.Mock;
  remove: jest.Mock;
  clear: jest.Mock;
  addItem: jest.Mock;
  addRecipes: jest.Mock;
} = {
  list: { data: undefined, isError: false, refetch: () => undefined },
  recipes: sampleRecipes,
  recipe: { status: "loading" },
  preview: { status: "loading" },
  previewCalls: [],
  toggle: jest.fn(),
  remove: jest.fn(),
  clear: jest.fn(),
  addItem: jest.fn(),
  addRecipes: jest.fn(),
};

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useShoppingList: () => mockApi.list,
  useToggleShoppingItem: () => ({ mutate: mockApi.toggle, isPending: false }),
  useRemoveShoppingItem: () => ({ mutate: mockApi.remove, isPending: false }),
  useClearTickedItems: () => ({ mutate: mockApi.clear, isPending: false }),
  useAddShoppingItem: () => ({ mutate: mockApi.addItem, isPending: false }),
  useAddRecipesToList: () => ({ mutate: mockApi.addRecipes, isPending: false }),
  useRecipes: () => ({ data: mockApi.recipes, isError: false, refetch: () => undefined }),
  useRecipe: () => mockApi.recipe,
  useShoppingPreview: (recipes: unknown) => {
    mockApi.previewCalls.push(recipes);
    return mockApi.preview;
  },
}));

setUpTests();

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

const firstRecipe = sampleRecipes[0];
if (firstRecipe === undefined) {
  throw new Error("The sample library must hold a recipe");
}

let queryClient: QueryClient;

async function show(route: "list" | "add") {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          {route === "list" ? <ShoppingListRoute /> : <AddToListRoute />}
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

const box = (name: string) => screen.getByRole("checkbox", { name });

describe("the shopping list screens", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/ShoppingListView",
      "components/ShoppingListScreen",
      "components/ShoppingItemRow",
      "components/AddToListScreen",
      "components/RecipeLoadState",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    mockApi.list = { data: [onions, binBags, milk], isError: false, refetch: () => undefined };
    mockApi.recipe = { status: "loading" };
    mockApi.preview = { status: "loading" };
    mockApi.previewCalls = [];
    for (const mock of [
      mockApi.toggle,
      mockApi.remove,
      mockApi.clear,
      mockApi.addItem,
      mockApi.addRecipes,
    ]) {
      mock.mockReset();
    }
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.restoreAllMocks();
  });

  describe("the list", () => {
    it("should be titled Shopping list, with what is to buy and then what is ticked", async () => {
      await show("list");

      expect(screen.getByRole("heading", { name: SHOPPING_LIST.title })).toBeOnTheScreen();
      const toBuy = screen.getByLabelText(SHOPPING_LIST.toBuy);
      const ticked = screen.getByLabelText(SHOPPING_LIST.ticked);
      expect(within(toBuy).getByRole("checkbox", { name: "Onions" })).not.toBeChecked();
      expect(within(toBuy).getByRole("checkbox", { name: "Bin bags" })).not.toBeChecked();
      expect(within(toBuy).queryByRole("checkbox", { name: "Milk" })).not.toBeOnTheScreen();
      expect(within(ticked).getByRole("checkbox", { name: "Milk" })).toBeChecked();
      expect(screen.getByText("2 × 1 medium · 300 g · From Chilli")).toBeOnTheScreen();
    });

    it("should tick, untick and remove an item by its id", async () => {
      const user = await show("list");

      await user.press(box("Onions"));
      await user.press(box("Milk"));
      await user.press(screen.getByRole("button", { name: "Remove Bin bags" }));

      expect(mockApi.toggle).toHaveBeenNthCalledWith(
        1,
        { id: onions.id, checked: true },
        expect.anything(),
      );
      expect(mockApi.toggle).toHaveBeenNthCalledWith(
        2,
        { id: milk.id, checked: false },
        expect.anything(),
      );
      expect(mockApi.remove).toHaveBeenCalledWith(binBags.id, expect.anything());
    });

    it("should say so in a toast when a change fails", async () => {
      mockApi.toggle.mockImplementation((_input: unknown, options: { onError: () => void }) => {
        options.onError();
      });
      const user = await show("list");

      await user.press(box("Onions"));

      expect(
        await screen.findByRole("status", { name: SHOPPING_LIST.changeFailed }),
      ).toBeOnTheScreen();
    });

    it("should add the typed words and empty the field once they are on the list", async () => {
      mockApi.addItem.mockImplementation((_text: string, options: { onSuccess: () => void }) => {
        options.onSuccess();
      });
      const user = await show("list");
      const field = screen.getByLabelText(SHOPPING_LIST.addItemPlaceholder);

      await user.type(field, "Kitchen roll");
      await user.press(screen.getByRole("button", { name: SHOPPING_LIST.addItem }));

      expect(mockApi.addItem).toHaveBeenCalledWith("Kitchen roll", expect.anything());
      expect(field).toHaveDisplayValue("");
    });

    it("should ask before clearing the ticked items, and clear them once confirmed", async () => {
      const user = await show("list");

      await user.press(screen.getByRole("button", { name: SHOPPING_LIST.clearTicked }));
      await user.press(
        await screen.findByRole("button", { name: SHOPPING_LIST_CLEAR_DIALOG.cancelLabel }),
      );
      expect(mockApi.clear).not.toHaveBeenCalled();

      await user.press(screen.getByRole("button", { name: SHOPPING_LIST.clearTicked }));
      expect(await screen.findByText(SHOPPING_LIST_CLEAR_DIALOG.body)).toBeOnTheScreen();
      // The answer has the same words as the button that asked, and is drawn after it.
      const answer = screen
        .getAllByRole("button", { name: SHOPPING_LIST_CLEAR_DIALOG.confirmLabel })
        .at(-1);
      if (answer === undefined) {
        throw new Error("The dialog must offer Clear ticked items");
      }
      await user.press(answer);
      expect(mockApi.clear).toHaveBeenCalledTimes(1);
    });

    it("should open the add screen for the recipe chosen, at its saved servings", async () => {
      const user = await show("list");

      await user.press(screen.getByRole("button", { name: SHOPPING_LIST.addRecipe }));
      await user.press(await screen.findByRole("button", { name: firstRecipe.name }));

      expect(routerMock.push).toHaveBeenCalledWith(
        addToListPath(firstRecipe.id, firstRecipe.servings),
      );
    });

    it("should say the list is empty when nothing is on it", async () => {
      mockApi.list = { data: [], isError: false, refetch: () => undefined };
      await show("list");

      expect(screen.getByText(SHOPPING_LIST_EMPTY.title)).toBeOnTheScreen();
      expect(screen.queryByRole("checkbox")).not.toBeOnTheScreen();
    });

    it("should keep a loaded list readable offline, with every control disabled", async () => {
      await show("list");
      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByText(SHOPPING_LIST.offlineBody)).toBeOnTheScreen();
      expect(box("Onions")).toBeDisabled();
      expect(screen.getByRole("button", { name: "Remove Onions" })).toBeDisabled();
      expect(screen.getByRole("button", { name: SHOPPING_LIST.addRecipe })).toBeDisabled();
      expect(screen.getByRole("button", { name: SHOPPING_LIST.clearTicked })).toBeDisabled();
    });

    it("should offer Try again when the list did not load", async () => {
      const refetch = jest.fn();
      mockApi.list = { data: undefined, isError: true, refetch };
      const user = await show("list");

      expect(screen.getByText(GENERIC_ERROR)).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Try again" }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("should go back to the library from a cold link", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = await show("list");

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.replace).toHaveBeenCalledWith(recipesPath());
    });
  });

  describe("adding a recipe", () => {
    const recipeDetail = (): RecipeState => ({
      status: "ready",
      recipe: {
        ...firstRecipe,
        instructions: [],
        ingredients: [],
      },
    });

    beforeEach(() => {
      mockApi.recipe = recipeDetail();
      mockApi.preview = {
        status: "ready",
        preview: {
          items: [
            {
              foodId: ONION_ID,
              name: "Onions",
              grams: 300,
              portionLabel: "1 medium",
              portionCount: 2,
              sources: [{ recipeId: firstRecipe.id, name: firstRecipe.name }],
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
              sources: [{ recipeId: firstRecipe.id, name: firstRecipe.name }],
              rule: "food_group",
            },
          ],
        },
      };
    });

    it("should start at the servings the address carries, and show what goes on the list", async () => {
      routerMock.searchParams = { id: firstRecipe.id, servings: "6" };
      await show("add");

      expect(mockApi.previewCalls.at(-1)).toEqual([{ id: firstRecipe.id, servings: 6 }]);
      expect(screen.getByText("2 × 1 medium · 300 g")).toBeOnTheScreen();
      expect(screen.getByText("1 store cupboard item left out")).toBeOnTheScreen();
    });

    it("should start at the recipe's own servings when the address carries none it can use", async () => {
      routerMock.searchParams = { id: firstRecipe.id, servings: "lots" };
      await show("add");

      expect(mockApi.previewCalls.at(-1)).toEqual([
        { id: firstRecipe.id, servings: firstRecipe.servings },
      ]);
    });

    it("should add the recipe with the staples chosen, then go back with a toast", async () => {
      mockApi.addRecipes.mockImplementation(
        (_input: unknown, options: { onSuccess: () => void }) => {
          options.onSuccess();
        },
      );
      routerMock.searchParams = { id: firstRecipe.id, servings: "6" };
      const user = await show("add");

      await user.press(box("Add Salt anyway"));
      await user.press(screen.getByRole("button", { name: SHOPPING_LIST.addItem }));

      expect(mockApi.addRecipes).toHaveBeenCalledWith(
        { recipes: [{ id: firstRecipe.id, servings: 6 }], addAnyway: [SALT_ID] },
        expect.anything(),
      );
      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole("status", { name: SHOPPING_LIST.added })).toBeOnTheScreen();
    });

    it("should say the recipe is not there for an address that cannot be a recipe", async () => {
      routerMock.searchParams = { id: "not-a-recipe", servings: "2" };
      await show("add");

      expect(screen.getByText("Recipe not found")).toBeOnTheScreen();
    });
  });
});
