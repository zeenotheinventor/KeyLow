import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from "@testing-library/react-native";
import { AccessibilityInfo, Keyboard } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RecipeEditor } from "../../components/RecipeEditor";
import { ToastProvider } from "../../components/ui";
import {
  beginIngredientScan,
  finishIngredientScan,
  takeIngredientScan,
} from "../../lib/ingredientScan";
import { resetIngredientScanForTests } from "../../lib/ingredientScan/testing";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RecipeEditorExisting } from "../../components/RecipeEditor";
import type { FoodSearchHit, FoodSearchResult, FoodWithPortionsState } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

// Scanning an ingredient from the recipe editor: Scan barcode in the Add ingredient search opens the scanner
// over the editor, and a food it finds comes back to the amount step. The scanner is another route, so
// here the router is a mock and the scanner's answer is given through the hand-back store, as the
// scanner screen does. The search and the food's read are stood in for.

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
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: () => undefined,
}));

const mockFoodWithPortions = jest.fn<FoodWithPortionsState, [string]>();
const mockFoodSearch = jest.fn<FoodSearchResult, [string]>();
const mockCreateRecipe = jest.fn();
const mockUpdateRecipe = jest.fn();

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useMaterialiseOffProduct: () => ({ mutateAsync: jest.fn() }),
  useCreateRecipe: () => ({ mutateAsync: mockCreateRecipe }),
  useUpdateRecipe: () => ({ mutateAsync: mockUpdateRecipe }),
  useFoodWithPortions: (id: string) => mockFoodWithPortions(id),
  useFoodSearch: (query: string) => mockFoodSearch(query),
  useRecentFoods: () => ({ data: [], isPending: false, isError: false }),
}));

setUpTests();

const uuidOf = (digit: string) =>
  `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;

const spinach = buildFood({
  id: uuidOf("5"),
  source: "cofid",
  name: "Spinach, baby, raw",
  kcal: 16,
  protein_g: 2.6,
  carbs_g: 0.2,
  fat_g: 0.6,
});
const onions = buildFood({
  id: uuidOf("4"),
  source: "cofid",
  name: "Onions, raw",
  kcal: 35,
  protein_g: 1,
  carbs_g: 8,
  fat_g: 0.1,
});
const mediumOnion = buildFoodPortion({
  id: uuidOf("d"),
  food_id: onions.id,
  label: "1 medium",
  grams: 110,
  is_default: true,
});
const allFoods = [spinach, onions];

function hitOf(food: ReturnType<typeof buildFood>): FoodSearchHit {
  return {
    id: food.id,
    source: food.source,
    name: food.name,
    brand: food.brand,
    basis: food.basis,
    kcal: food.kcal,
    protein_g: food.protein_g,
    fat_g: food.fat_g,
    carbs_g: food.carbs_g,
    fibre_g: food.fibre_g,
    quality: food.quality,
    default_portion_id: null,
    default_portion_label: null,
    default_portion_grams: null,
    default_portion_ml: null,
    score: 0.9,
  };
}

const idleSearch: FoodSearchResult = {
  local: [],
  off: [],
  isLoadingLocal: false,
  isLoadingOff: false,
  isDebouncing: false,
  offError: null,
  localError: null,
};

const spinachSaved = buildRecipeIngredient(spinach, { quantity: 100, unit: "g" });

const savedRecipe: RecipeEditorExisting = {
  id: "55555555-5555-4555-8555-555555555555",
  name: "Spinach bake",
  servings: 1,
  yield_grams: null,
  instructions: ["Bake it."],
  ingredients: [spinachSaved],
};

let queryClient: QueryClient;

async function showEditor(existing?: RecipeEditorExisting) {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <RecipeEditor existing={existing} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

const card = () => within(screen.getByLabelText("Per serving"));
const addRow = () => screen.getByRole("button", { name: "Add ingredient" });
const searchField = () => screen.getByRole("searchbox", { name: "Search foods" });
const scanButton = () => screen.getByRole("button", { name: "Scan barcode" });
const addToRecipe = () => screen.getByRole("button", { name: "Add to recipe" });
const letTypingStop = () =>
  act(() => {
    jest.advanceTimersByTime(500);
  });

// The id the editor put in the scanner's link, which is what the scanner screen hands its answer back with.
function scannerRequestId(): string {
  const [href] = routerMock.push.mock.calls.at(-1) ?? [];
  const requestId = new URL(href ?? "", "https://app.test").searchParams.get("ingredient");
  if (requestId === null) {
    throw new Error("The editor pushed no scanner link with a request");
  }
  return requestId;
}

async function scannerFinds(foodId: string) {
  await act(() => {
    finishIngredientScan(scannerRequestId(), foodId);
  });
}

async function addSpinachBySearch(user: ReturnType<typeof userEvent.setup>) {
  mockFoodSearch.mockReturnValue({ ...idleSearch, local: [hitOf(spinach)] });
  await user.press(addRow());
  await fireEvent.changeText(searchField(), "spinach");
  await user.press(
    screen.getByRole("button", { name: "Spinach, baby, raw, 100 g, choose amount" }),
  );
  await user.press(addToRecipe());
  mockFoodSearch.mockReturnValue(idleSearch);
}

const ingredientRows = () =>
  within(screen.getByLabelText("Ingredients")).getAllByRole("button", { name: /change amount$/ });

describe("scanning an ingredient from the recipe editor", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeEditor",
      "components/RecipeDetailsFields",
      "components/RecipeIngredientsSection",
      "components/PerServingCard",
      "components/DiscardRecipeSheet",
      "components/FoodDetail",
      "components/PortionPicker",
      "components/IngredientAmountStep",
      "components/AddIngredientSheet",
      "components/AddIngredientAmountStep",
      "components/FoodLoadState",
      "components/FoodSearch",
    ]);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    resetIngredientScanForTests();
    mockFoodSearch.mockReset();
    mockFoodSearch.mockReturnValue(idleSearch);
    mockFoodWithPortions.mockReset();
    mockFoodWithPortions.mockImplementation((id) => {
      const food = allFoods.find((candidate) => candidate.id === id);
      return food === undefined
        ? { status: "notFound" }
        : { status: "ready", food, portions: id === onions.id ? [mediumOnion] : [] };
    });
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("the Scan barcode button", () => {
    it("should end the search field of the Add ingredient sheet", async () => {
      const user = await showEditor();

      await user.press(addRow());

      expect(scanButton()).toBeOnTheScreen();
    });

    it("should open the scanner over the editor, with the id of a new request in its link", async () => {
      const user = await showEditor();
      await user.press(addRow());

      await user.press(scanButton());

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(
        expect.stringMatching(/^\/foods\/scan\?ingredient=[^&]+$/),
      );
    });

    it("should put the keyboard away first", async () => {
      const dismiss = jest.spyOn(Keyboard, "dismiss");
      const user = await showEditor();
      await user.press(addRow());
      dismiss.mockClear();

      await user.press(scanButton());

      expect(dismiss).toHaveBeenCalled();
    });
  });

  describe("a new recipe", () => {
    it("should open the amount step for the scanned food, and Add to recipe adds it with the draft as it was", async () => {
      const user = await showEditor();
      await fireEvent.changeText(screen.getByLabelText("Name"), "Scan test");
      await addSpinachBySearch(user);
      await letTypingStop();
      expect(card().getByText("16")).toBeOnTheScreen();
      await user.press(addRow());
      await user.press(scanButton());

      await scannerFinds(onions.id);

      expect(screen.getByRole("heading", { name: "Onions, raw" })).toBeOnTheScreen();
      await user.press(addToRecipe());
      await letTypingStop();
      expect(screen.queryByRole("heading", { name: "Add ingredient" })).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Ingredients · 2" })).toBeOnTheScreen();
      expect(ingredientRows()).toHaveLength(2);
      expect(ingredientRows()[1]).toHaveAccessibleName(
        "Onions, raw, 1 medium (110 g), change amount",
      );
      expect(screen.getByLabelText("Name")).toHaveDisplayValue("Scan test");
      expect(card().getByText("55")).toBeOnTheScreen();
    });

    it("should open the amount step as soon as the scanner answers", async () => {
      const user = await showEditor();
      await user.press(addRow());
      await user.press(scanButton());

      await scannerFinds(onions.id);

      expect(screen.getByRole("button", { name: "Add to recipe" })).toBeOnTheScreen();
    });

    it("should go Back from the step to the search with the words as typed", async () => {
      const user = await showEditor();
      await user.press(addRow());
      await fireEvent.changeText(searchField(), "oni");
      await user.press(scanButton());
      await scannerFinds(onions.id);

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(screen.getByRole("heading", { name: "Add ingredient" })).toBeOnTheScreen();
      expect(searchField()).toHaveDisplayValue("oni");
      expect(screen.queryByRole("heading", { name: "Ingredients · 1" })).not.toBeOnTheScreen();
    });
  });

  describe("an existing recipe", () => {
    it("should keep the saved ingredients and add the scanned one at the end", async () => {
      const user = await showEditor(savedRecipe);
      expect(ingredientRows()).toHaveLength(1);
      await user.press(addRow());
      await user.press(scanButton());

      await scannerFinds(onions.id);
      await user.press(addToRecipe());

      expect(screen.getByRole("heading", { name: "Ingredients · 2" })).toBeOnTheScreen();
      expect(ingredientRows()[0]).toHaveAccessibleName("Spinach, baby, raw, 100 g, change amount");
      expect(ingredientRows()[1]).toHaveAccessibleName(
        "Onions, raw, 1 medium (110 g), change amount",
      );
      expect(screen.getByRole("heading", { name: "Spinach bake" })).toBeOnTheScreen();
      expect(mockUpdateRecipe).not.toHaveBeenCalled();
    });
  });

  describe("a scan that is cancelled", () => {
    it("should leave the search open as it was and add nothing", async () => {
      const user = await showEditor(savedRecipe);
      await user.press(addRow());
      await fireEvent.changeText(searchField(), "oni");
      await user.press(scanButton());

      // The person backs out of the scanner, which finishes nothing.

      expect(screen.getByRole("heading", { name: "Add ingredient" })).toBeOnTheScreen();
      expect(searchField()).toHaveDisplayValue("oni");
      expect(screen.queryByRole("button", { name: "Add to recipe" })).not.toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Close" }));
      expect(ingredientRows()).toHaveLength(1);
    });
  });

  describe("a result that is not for this request", () => {
    it("should be ignored when it comes from a request that is not pending", async () => {
      const user = await showEditor(savedRecipe);
      await user.press(addRow());
      await user.press(scanButton());

      await act(() => {
        finishIngredientScan("someone-else", onions.id);
      });

      expect(screen.queryByRole("button", { name: "Add to recipe" })).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Add ingredient" })).toBeOnTheScreen();
    });

    it("should be ignored when it comes from an earlier request that a newer one replaced", async () => {
      const user = await showEditor(savedRecipe);
      await user.press(addRow());
      await user.press(scanButton());
      const firstRequestId = scannerRequestId();
      await user.press(scanButton());

      await act(() => {
        finishIngredientScan(firstRequestId, onions.id);
      });

      expect(screen.queryByRole("button", { name: "Add to recipe" })).not.toBeOnTheScreen();
    });

    it("should be ignored once the editor has gone, which ends its request", async () => {
      const user = await showEditor(savedRecipe);
      await user.press(addRow());
      await user.press(scanButton());
      const requestId = scannerRequestId();
      await cleanup();

      finishIngredientScan(requestId, onions.id);

      expect(takeIngredientScan(requestId)).toBeUndefined();
    });

    it("should not open the amount step of a request that another editor began", async () => {
      await showEditor(savedRecipe);

      await act(() => {
        finishIngredientScan(beginIngredientScan(), onions.id);
      });

      expect(screen.queryByRole("button", { name: "Add to recipe" })).not.toBeOnTheScreen();
    });
  });
});
