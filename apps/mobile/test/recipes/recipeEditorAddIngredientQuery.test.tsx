import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RecipeEditor } from "../../components/RecipeEditor";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RecipeEditorExisting } from "../../components/RecipeEditor";
import type { FoodSearchResult } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

// The assistant's link from an imported recipe's unmatched line opens the editor with the add-ingredient
// search already open on the line's food word. The search itself is stood in for.

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
jest.mock("expo-router/react-navigation", () => ({ usePreventRemove: () => undefined }));

const mockFoodSearch = jest.fn<FoodSearchResult, [string]>();

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useCreateRecipe: () => ({ mutateAsync: jest.fn() }),
  useUpdateRecipe: () => ({ mutateAsync: jest.fn() }),
  useFoodSearch: (query: string) => mockFoodSearch(query),
  useRecentFoods: () => ({ data: [], isPending: false, isError: false }),
}));

setUpTests();

const idleSearch: FoodSearchResult = {
  local: [],
  off: [],
  isLoadingLocal: false,
  isLoadingOff: false,
  isDebouncing: false,
  offError: null,
  localError: null,
};

const recipe: RecipeEditorExisting = {
  id: "55555555-5555-4555-8555-555555555555",
  name: "Lemon chicken traybake",
  servings: 4,
  yield_grams: null,
  instructions: [],
  ingredients: [],
};

let queryClient: QueryClient;

async function showEditor(initialIngredientSearch?: string) {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <RecipeEditor existing={recipe} initialIngredientSearch={initialIngredientSearch} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

describe("the recipe editor opened on an ingredient search", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeEditor",
      "components/FoodSearch",
      "components/AddIngredientSheet",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    mockFoodSearch.mockReset();
    mockFoodSearch.mockReturnValue(idleSearch);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.restoreAllMocks();
  });

  it("should open Add ingredient with the search holding the word", async () => {
    await showEditor("white wine");

    expect(screen.getByRole("heading", { name: "Add ingredient" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Search foods")).toHaveDisplayValue("white wine");
    expect(mockFoodSearch).toHaveBeenCalledWith("white wine");
  });

  it("should open on the editor alone when there is no word", async () => {
    await showEditor();

    expect(screen.queryByRole("heading", { name: "Add ingredient" })).not.toBeOnTheScreen();
    expect(screen.getByLabelText("Name")).toHaveDisplayValue("Lemon chicken traybake");
  });
});
