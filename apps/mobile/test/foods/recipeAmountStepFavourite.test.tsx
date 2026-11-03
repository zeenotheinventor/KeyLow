import "react-native-gesture-handler/jestSetup";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import {
  mockToggleFavouriteRecipe,
  recipeState,
  resetApiClientMock,
} from "./support/apiClientMock";
import { goldenRecipeDetail, goldenRecipeId } from "./support/recipeFixtures";
import RecipeAmountRoute from "../../app/foods/recipe/[id]/log";
import { ToastProvider, sheetHeaderHeight } from "../../components/ui";
import { PlateProvider } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

// The favourite heart in the header of a recipe's amount step. The heart's own behaviour is pinned in
// recipeViewFavourite.test.tsx.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "@keylow/api-client",
  () => jest.requireActual<{ mockApiClient: unknown }>("./support/apiClientMock").mockApiClient,
);

setUpTests();

async function renderStep() {
  routerMock.searchParams = { id: goldenRecipeId, day: "2026-10-15", time: "18:00" };
  const user = userEvent.setup();
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider fixedPreference="dark">
        <ToastProvider>
          <PlateProvider>
            <RecipeAmountRoute />
          </PlateProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return user;
}

const addHeart = () => screen.getByRole("button", { name: "Add to favourites" });

describe("the favourite heart on the recipe amount step header", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetApiClientMock();
    onlineManager.setOnline(true);
    recipeState.current = { status: "ready", recipe: goldenRecipeDetail() };
  });

  it("should be in the header", async () => {
    await renderStep();

    expect(addHeart()).toBeOnTheScreen();
  });

  it("should favourite the recipe on a tap and say so in a toast under the header", async () => {
    const user = await renderStep();

    await user.press(addHeart());

    expect(mockToggleFavouriteRecipe).toHaveBeenCalledTimes(1);
    expect(mockToggleFavouriteRecipe.mock.calls[0]?.[0].favourite).toBe(true);
    expect(await screen.findByRole("status", { name: "Added to favourites" })).toBeOnTheScreen();
    expect(screen.getByTestId("toast")).toHaveStyle({ top: sheetHeaderHeight.sheet });
  });

  it("should be disabled while the phone is offline", async () => {
    await renderStep();

    await act(() => {
      onlineManager.setOnline(false);
    });

    expect(addHeart()).toBeDisabled();
  });
});
