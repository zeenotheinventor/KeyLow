import { FavouriteRuleError, KeyLowProvider } from "@keylow/api-client";
import { GENERIC_ERROR } from "@keylow/core/copy";
import { computeRecipe } from "@keylow/core/recipes";
import { themes } from "@keylow/tokens";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { chickenAndRiceRecipe } from "./recipeViewFixtures";
import { RecipeView } from "../../components/RecipeView";
import { ToastProvider, sheetHeaderHeight } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import {
  favouriteRecipes,
  mockToggleFavouriteRecipe,
  mockUseFavouriteRecipes,
  resetApiClientMock,
} from "../foods/support/apiClientMock";
import { createDiaryQueryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { recipeWritesClient } from "../support/recipeWritesBackend";
import { installVirtualClock } from "../support/virtualClock";

import type { FavouriteRecipe } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

// The heart in the recipe view's header: its state, its toasts and its offline look. The favourites hooks are
// replaced, because their own tests cover the cache and the rollback, so these tests read what the view asks.

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
jest.mock("../../lib/useReadsEnabled", () => ({ useReadsEnabled: () => true }));
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  ...jest.requireActual<{ mockFavouriteHooks: object }>("../foods/support/apiClientMock")
    .mockFavouriteHooks,
}));

setUpTests();

const savedFavourite: FavouriteRecipe = {
  recipeId: chickenAndRiceRecipe.id,
  createdAt: "2026-11-03T09:00:00+00:00",
  recipe: {
    id: chickenAndRiceRecipe.id,
    name: chickenAndRiceRecipe.name,
    servings: 4,
    yield_grams: 1100,
    is_archived: false,
    computed: computeRecipe({
      servings: 4,
      yieldGrams: 1100,
      ingredients: chickenAndRiceRecipe.ingredients,
    }),
  },
};

let queryClient: QueryClient;

async function showView() {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={recipeWritesClient} queryClient={queryClient}>
        <ToastProvider>
          <RecipeView recipe={chickenAndRiceRecipe} onBack={jest.fn()} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

const addHeart = () => screen.getByRole("button", { name: "Add to favourites" });
const removeHeart = () => screen.getByRole("button", { name: "Remove from favourites" });

// An icon in a button is decoration and has no role to query by, so its drawing is looked for.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

describe("the favourite heart on the recipe view header", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeView",
      "components/RecipeViewMenu",
      "components/ServingsCard",
      "components/RecipeViewIngredientsSection",
      "components/RecipeViewStepsSection",
      "components/StepRow",
      "components/PerServingCard",
    ]);
  });

  beforeEach(() => {
    installVirtualClock();
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    resetApiClientMock();
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 });
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
    jest.useRealTimers();
  });

  it("should be the header's first control after Back, before Edit and More", async () => {
    await showView();

    const buttons = screen.getAllByRole("button");
    ["Back", "Add to favourites", "Edit Chicken and rice", "More"].forEach((name, index) => {
      expect(buttons[index]).toHaveAccessibleName(name);
    });
    expect(drawings()[1]).toHaveProp("fill", "none");
  });

  it("should be filled in the accent and named Remove from favourites when the recipe is a favourite", async () => {
    favouriteRecipes.current = { data: [savedFavourite], isPending: false, isError: false };

    await showView();

    expect(removeHeart()).toBeOnTheScreen();
    expect(drawings()[1]).toHaveProp("fill", themes.dark.accent);
  });

  it("should read the favourite recipes", async () => {
    await showView();

    expect(mockUseFavouriteRecipes).toHaveBeenCalledWith({ enabled: true });
  });

  it("should favourite the recipe on a tap, as a summary of it, and say so in a toast", async () => {
    const user = await showView();

    await user.press(addHeart());

    expect(mockToggleFavouriteRecipe).toHaveBeenCalledTimes(1);
    expect(mockToggleFavouriteRecipe.mock.calls[0]?.[0]).toMatchObject({
      favourite: true,
      recipe: {
        id: chickenAndRiceRecipe.id,
        name: "Chicken and rice",
        servings: 4,
        yield_grams: 1100,
        is_archived: false,
      },
    });
    expect(await screen.findByRole("status", { name: "Added to favourites" })).toBeOnTheScreen();
  });

  it("should sit its toast just under the sheet header, so the heart stays in view", async () => {
    const user = await showView();

    await user.press(addHeart());

    await screen.findByRole("status", { name: "Added to favourites" });
    expect(screen.getByTestId("toast")).toHaveStyle({ top: sheetHeaderHeight.sheet });
  });

  it("should unfavourite the recipe on a tap when it is a favourite, with its own toast", async () => {
    favouriteRecipes.current = { data: [savedFavourite], isPending: false, isError: false };
    const user = await showView();

    await user.press(removeHeart());

    expect(mockToggleFavouriteRecipe.mock.calls[0]?.[0]).toMatchObject({ favourite: false });
    expect(
      await screen.findByRole("status", { name: "Removed from favourites" }),
    ).toBeOnTheScreen();
  });

  it("should say you can have up to 30 favourites when the limit refuses one", async () => {
    mockToggleFavouriteRecipe.mockRejectedValue(
      new FavouriteRuleError("favourite the recipe", "favourite_limit"),
    );
    const user = await showView();

    await user.press(addHeart());

    expect(
      await screen.findByRole("status", {
        name: "You can have up to 30 favourites. Remove one to add another.",
      }),
    ).toBeOnTheScreen();
  });

  it("should show the generic error and keep the heart as the list says when the write fails", async () => {
    mockToggleFavouriteRecipe.mockRejectedValue(new Error("Could not favourite the recipe (500)"));
    const user = await showView();

    await user.press(addHeart());

    expect(await screen.findByRole("status", { name: GENERIC_ERROR })).toBeOnTheScreen();
    expect(addHeart()).toBeOnTheScreen();
  });

  it("should be disabled offline, as Edit and More are", async () => {
    await showView();

    await act(() => {
      onlineManager.setOnline(false);
    });

    expect(addHeart()).toBeDisabled();
    expect(screen.getByRole("button", { name: "More" })).toBeDisabled();
  });
});
