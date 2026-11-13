import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import { DISCARD_SHEET } from "@keylow/core/copy";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RecipeEditor } from "../../components/RecipeEditor";
import { ToastProvider } from "../../components/ui";
import { recipePath } from "../../lib/recipeRoutes";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RecipeDraft } from "@keylow/core/recipes";
import type { QueryClient } from "@tanstack/react-query";

// The recipe editor opened on a recipe the assistant drafted (Save to recipes on the suggested recipe card): it
// shows the draft as a new recipe, writes nothing until Save, and tells whoever opened it which recipe it saved.

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

const mockCreateRecipe = jest.fn();

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useCreateRecipe: () => ({ mutateAsync: mockCreateRecipe }),
  useUpdateRecipe: () => ({ mutateAsync: jest.fn() }),
}));

setUpTests();

const SAVED_ID = "66666666-6666-4666-8666-666666666666";
const golden = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: null });

const drafted: RecipeDraft = {
  name: "Chicken and rice from the assistant",
  servings: "2",
  cookedWeight: "",
  ingredients: golden.ingredients,
  steps: ["Cook the rice.", "Fry the chicken."],
};

let queryClient: QueryClient;
let onSaved: jest.Mock;

async function showEditor() {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <RecipeEditor initialDraft={drafted} onSaved={onSaved} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

describe("the recipe editor opened on a recipe the assistant drafted", () => {
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
    onSaved = jest.fn();
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
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

  it("should open as a new recipe, filled in with the draft's name and servings", async () => {
    await showEditor();

    expect(screen.getByRole("heading", { name: "New recipe" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Name")).toHaveDisplayValue("Chicken and rice from the assistant");
    expect(screen.getByLabelText("Servings")).toHaveDisplayValue("2");
  });

  it("should list the draft's ingredients", async () => {
    await showEditor();

    expect(screen.getByRole("heading", { name: "Ingredients · 3" })).toBeOnTheScreen();
    const list = within(screen.getByLabelText("Ingredients"));
    expect(list.getByText("Chicken breast")).toBeOnTheScreen();
    expect(list.getByText("Dry rice")).toBeOnTheScreen();
  });

  it("should write nothing until the person presses Save", async () => {
    await showEditor();

    expect(mockCreateRecipe).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("should save the draft as a new recipe on Save, and say which recipe it saved", async () => {
    mockCreateRecipe.mockImplementation((payload: { name: string }) =>
      Promise.resolve({
        id: SAVED_ID,
        name: payload.name,
        servings: 2,
        yield_grams: null,
        instructions: drafted.steps,
        ingredients: golden.ingredients,
      }),
    );
    const user = await showEditor();

    await user.press(screen.getByRole("button", { name: "Save" }));

    expect(mockCreateRecipe).toHaveBeenCalledTimes(1);
    expect(mockCreateRecipe).toHaveBeenCalledWith({
      name: "Chicken and rice from the assistant",
      servings: 2,
      yieldGrams: null,
      steps: ["Cook the rice.", "Fry the chicken."],
      ingredients: golden.ingredients,
    });
    expect(onSaved).toHaveBeenCalledWith(SAVED_ID);
    await act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(routerMock.replace).toHaveBeenCalledWith(recipePath(SAVED_ID));
  });

  it("should not say a recipe was saved when the save failed", async () => {
    mockCreateRecipe.mockRejectedValue(new Error("offline"));
    const user = await showEditor();

    await user.press(screen.getByRole("button", { name: "Save" }));

    expect(onSaved).not.toHaveBeenCalled();
  });

  it("should ask before the draft is thrown away, because it is a change from an empty recipe", async () => {
    const user = await showEditor();

    await user.press(screen.getByRole("button", { name: "Close" }));

    expect(screen.getByRole("heading", { name: DISCARD_SHEET.newTitle })).toBeOnTheScreen();
  });
});
