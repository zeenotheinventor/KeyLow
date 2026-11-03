import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import {
  favouriteFoods,
  favouriteRecipes,
  foodFixture,
  mockUseFavouriteFoods,
  mockUseFavouriteRecipes,
  recentFoods,
  resetApiClientMock,
  termsAccepted,
} from "./support/apiClientMock";
import { compileFoodSearchStyles } from "./support/foodSearchStyles";
import { resetSearchApiClientMock } from "./support/searchApiClientMock";
import FoodSearchRoute from "../../app/foods/index";
import { ToastProvider } from "../../components/ui";
import { PlateProvider } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";

import type { FavouriteFood, FavouriteRecipe, RecipeSummary } from "@keylow/api-client";

// The Favourites strip of the log search: between Quick add and Recent, a tile for each favourite food and
// recipe, newest first. A tap opens the amount step as a Recent row or a recipe row does.

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockSearchApiClient: unknown }>("./support/searchApiClientMock")
      .mockSearchApiClient,
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-router/react-navigation", () => ({ usePreventRemove: () => undefined }));

setUpTests();

const porridgeId = "11111111-1111-4111-8111-1111111111f1";
const bananaId = "11111111-1111-4111-8111-1111111111f2";
const oatsRecipeId = "00000000-0000-4000-8000-0000000000b1";
const unloggableRecipeId = "00000000-0000-4000-8000-0000000000b2";

const favouriteFood = (foodId: string, name: string, createdAt: string): FavouriteFood => ({
  foodId,
  createdAt,
  food: { ...foodFixture, id: foodId, name },
});

const recipeSummary = (id: string, name: string, kcal: number | null): RecipeSummary => ({
  id,
  name,
  servings: 4,
  yield_grams: 1100,
  is_archived: false,
  computed: {
    total: { kcal: 1496.8, protein_g: 126.5, carbs_g: 170.2, fat_g: 32.5, fibre_g: null },
    perServing: { kcal, protein_g: 31.6, carbs_g: 42.5, fat_g: 8.1, fibre_g: null },
    per100g: { kcal: 136.1, protein_g: 11.5, carbs_g: 15.5, fat_g: 2.95, fibre_g: null },
    totalGrams: 720,
    effectiveGrams: 1100,
    engineVersion: 1,
  },
});

const favouriteRecipe = (recipe: RecipeSummary, createdAt: string): FavouriteRecipe => ({
  recipeId: recipe.id,
  createdAt,
  recipe,
});

async function renderLogSearch() {
  routerMock.searchParams = { day: "2026-10-14", time: "12:00" };
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <PlateProvider>
          <FoodSearchRoute />
        </PlateProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
  return user;
}

describe("the Favourites strip in the log search", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileFoodSearchStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-10-15T11:40:30Z") });
    registerAppStyles(styles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    resetRouterMock();
    resetApiClientMock();
    resetSearchApiClientMock();
    onlineManager.setOnline(true);
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await act(() => {
      onlineManager.setOnline(true);
    });
  });

  it("should have no strip and no heading when nothing is favourited", async () => {
    await renderLogSearch();

    expect(screen.queryByRole("heading", { name: "Favourites" })).not.toBeOnTheScreen();
  });

  it("should list foods and recipes together, newest favourite first, between Quick add and Recent", async () => {
    favouriteFoods.current = {
      data: [
        favouriteFood(porridgeId, "Porridge", "2026-10-13T08:00:00+00:00"),
        favouriteFood(bananaId, "Banana", "2026-10-10T08:00:00+00:00"),
      ],
      isPending: false,
      isError: false,
    };
    favouriteRecipes.current = {
      data: [
        favouriteRecipe(
          recipeSummary(oatsRecipeId, "Overnight oats", 300),
          "2026-10-12T08:00:00+00:00",
        ),
      ],
      isPending: false,
      isError: false,
    };
    await renderLogSearch();

    expect(screen.getByRole("heading", { name: "Favourites" })).toBeOnTheScreen();
    expectTextsInOrder(
      screen.getAllByText(/^(Quick add|Favourites|Porridge|Overnight oats|Banana|Nothing recent)/),
      ["Quick add", "Favourites", "Porridge", "Overnight oats", "Banana", "Nothing recent"],
    );
  });

  it("should leave out a recipe that cannot be logged", async () => {
    favouriteRecipes.current = {
      data: [
        favouriteRecipe(
          recipeSummary(unloggableRecipeId, "Mystery stew", null),
          "2026-10-12T08:00:00+00:00",
        ),
      ],
      isPending: false,
      isError: false,
    };
    await renderLogSearch();

    expect(
      screen.queryByRole("button", { name: "Log Mystery stew, recipe" }),
    ).not.toBeOnTheScreen();
    expect(screen.queryByRole("heading", { name: "Favourites" })).not.toBeOnTheScreen();
  });

  it("should open the portion picker, on the last amount, when a food tile is pressed", async () => {
    favouriteFoods.current = {
      data: [favouriteFood(porridgeId, "Porridge", "2026-10-13T08:00:00+00:00")],
      isPending: false,
      isError: false,
    };
    const user = await renderLogSearch();

    await user.press(screen.getByRole("button", { name: "Log Porridge" }));

    expect(routerMock.push).toHaveBeenCalledWith(
      `/foods/${porridgeId}/log?day=2026-10-14&time=12%3A00&recent=1`,
    );
  });

  it("should open the recipe amount step when a recipe tile is pressed", async () => {
    favouriteRecipes.current = {
      data: [
        favouriteRecipe(
          recipeSummary(oatsRecipeId, "Overnight oats", 300),
          "2026-10-12T08:00:00+00:00",
        ),
      ],
      isPending: false,
      isError: false,
    };
    const user = await renderLogSearch();

    await user.press(screen.getByRole("button", { name: "Log Overnight oats, recipe" }));

    expect(routerMock.push).toHaveBeenCalledWith(
      `/foods/recipe/${oatsRecipeId}/log?day=2026-10-14&time=12%3A00`,
    );
  });

  it("should show skeleton tiles, not the heading's content, while the favourites load", async () => {
    favouriteFoods.current = { data: undefined, isPending: true, isError: false };
    await renderLogSearch();

    expect(screen.getByRole("heading", { name: "Favourites" })).toBeOnTheScreen();
    expect(
      screen.getByTestId("skeleton-favourites", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it("should hide the strip when the favourites fail to load, and leave Recent working", async () => {
    favouriteFoods.current = { data: undefined, isPending: false, isError: true };
    await renderLogSearch();

    expect(screen.queryByRole("heading", { name: "Favourites" })).not.toBeOnTheScreen();
    expect(screen.getByText("Nothing recent")).toBeOnTheScreen();
    expect(recentFoods.current.isError).toBe(false);
  });

  it("should hide the strip when the foods load and only the recipes fail to load", async () => {
    favouriteFoods.current = {
      data: [favouriteFood(porridgeId, "Porridge", "2026-10-13T08:00:00+00:00")],
      isPending: false,
      isError: false,
    };
    favouriteRecipes.current = { data: undefined, isPending: false, isError: true };
    await renderLogSearch();

    expect(screen.queryByRole("heading", { name: "Favourites" })).not.toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Log Porridge" })).not.toBeOnTheScreen();
  });

  it("should drop a tile when its favourite is removed", async () => {
    favouriteFoods.current = {
      data: [favouriteFood(porridgeId, "Porridge", "2026-10-13T08:00:00+00:00")],
      isPending: false,
      isError: false,
    };
    await renderLogSearch();
    expect(screen.getByRole("button", { name: "Log Porridge" })).toBeOnTheScreen();

    const searchField = screen.getByRole("searchbox", { name: "Search foods" });
    // Typing and clearing brings the idle list back, which reads the favourites again.
    await fireEvent.changeText(searchField, "por");
    favouriteFoods.current = { data: [], isPending: false, isError: false };
    await fireEvent.changeText(searchField, "");

    expect(screen.queryByRole("button", { name: "Log Porridge" })).not.toBeOnTheScreen();
  });

  it("should read nothing while the Terms are not accepted", async () => {
    termsAccepted.current = false;
    await renderLogSearch();

    expect(mockUseFavouriteFoods).toHaveBeenCalled();
    expect(mockUseFavouriteFoods.mock.calls.every(([options]) => options?.enabled === false)).toBe(
      true,
    );
    expect(
      mockUseFavouriteRecipes.mock.calls.every(([options]) => options?.enabled === false),
    ).toBe(true);
  });
});
