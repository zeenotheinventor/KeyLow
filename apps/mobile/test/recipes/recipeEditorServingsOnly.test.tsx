import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import { RECIPE_EDITOR, RECIPE_PROBLEMS } from "@keylow/core/copy";
import { buildBucketAndFriesRecipe } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
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
import type { RecipeDraft } from "@keylow/core/recipes";
import type { QueryClient } from "@tanstack/react-query";

// The recipe editor with a recipe handed to it, as the recipe view will give it: what it shows, how Save and
// leaving behave. The hooks that talk to the database are stood in for, so each test says what Save answers.

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

// What the navigator is told about holding the screen back, so a test can press the Android back button or
// swipe back as the navigator would.
type HoldEvent = { data: { action: { type: string } } };
const mockHold: { isHeld: boolean; onHeld: (event: HoldEvent) => void } = {
  isHeld: false,
  onHeld: () => undefined,
};
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (isHeld: boolean, onHeld: (event: HoldEvent) => void) => {
    mockHold.isHeld = isHeld;
    mockHold.onHeld = onHeld;
  },
}));

const mockCreateRecipe = jest.fn();
const mockUpdateRecipe = jest.fn();
const mockStartingDraft: { current: RecipeDraft | undefined } = { current: undefined };

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useCreateRecipe: () => ({ mutateAsync: mockCreateRecipe }),
  useUpdateRecipe: () => ({ mutateAsync: mockUpdateRecipe }),
}));

// A test that stands in for the ingredients a later ticket adds gives the new recipe some.
jest.mock("@keylow/core/recipes", () => {
  const actual = jest.requireActual<typeof import("@keylow/core/recipes")>("@keylow/core/recipes");
  return {
    ...actual,
    newRecipeDraft: (name?: string) => mockStartingDraft.current ?? actual.newRecipeDraft(name),
  };
});

setUpTests();

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

let queryClient: QueryClient;

async function showEditor(props: { existing?: RecipeEditorExisting; initialName?: string } = {}) {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <RecipeEditor {...props} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

const cookedWeightField = () => screen.queryByLabelText(RECIPE_EDITOR.cookedWeightName);
const saveButton = () => screen.getByRole("button", { name: "Save" });
const card = () => within(screen.getByLabelText("Per serving"));

// The card follows the fields once typing has stopped.
const letTypingStop = () =>
  act(() => {
    jest.advanceTimersByTime(500);
  });

describe("the recipe editor", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeEditor",
      "components/RecipeDetailsFields",
      "components/RecipeIngredientsSection",
      "components/PerServingCard",
      "components/DiscardRecipeSheet",
      "components/FoodDetail",
    ]);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    mockCreateRecipe.mockReset();
    mockUpdateRecipe.mockReset();
    mockStartingDraft.current = undefined;
    mockHold.isHeld = false;
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
    // The mock's calls are kept between tests when the spy is not restored in time, so the count starts at 0.
    jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
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

  describe("a recipe with a food counted in portions (ADR 0003, Amendment 19)", () => {
    it("should list the bucket by its portions, with no grams", async () => {
      await showEditor({ existing: servingsOnlyRecipe });

      expect(screen.getByText("1 bucket")).toBeOnTheScreen();
      expect(screen.getByText("200 g")).toBeOnTheScreen();
    });

    it("should have no cooked weight field", async () => {
      await showEditor({ existing: servingsOnlyRecipe });

      expect(cookedWeightField()).not.toBeOnTheScreen();
    });

    it("should caption the card Per serving, with no grams and no values per 100 g", async () => {
      await showEditor({ existing: servingsOnlyRecipe });
      await letTypingStop();

      expect(card().getByText("Per serving")).toBeOnTheScreen();
      expect(card().queryByText(/Per 100 g/)).not.toBeOnTheScreen();
    });

    it("should save with no cooked weight", async () => {
      mockUpdateRecipe.mockResolvedValue(servingsOnlyRecipe);
      const user = await showEditor({ existing: servingsOnlyRecipe });

      await user.press(saveButton());

      expect(mockUpdateRecipe).toHaveBeenCalledWith(expect.objectContaining({ yieldGrams: null }));
    });

    it("should refuse a cooked weight typed before the bucket was added, and say why on the field", async () => {
      const user = await showEditor({ existing: { ...servingsOnlyRecipe, yield_grams: 900 } });

      expect(cookedWeightField()).toBeOnTheScreen();
      await user.press(saveButton());

      expect(screen.getByText(RECIPE_PROBLEMS.cookedWeightWithRestaurantFood)).toBeOnTheScreen();
      expect(mockUpdateRecipe).not.toHaveBeenCalled();
    });
  });
});
