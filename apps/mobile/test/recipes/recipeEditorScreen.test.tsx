import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import { GENERIC_ERROR, RECIPE_EDITOR } from "@keylow/core/copy";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import EditRecipeRoute from "../../app/recipes/[id]/edit";
import NewRecipeRoute from "../../app/recipes/new";
import { ToastProvider } from "../../components/ui";
import { recipePath } from "../../lib/recipeRoutes";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RecipeState } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

// The route that opens a saved recipe in its editor, which sends the user to the recipe view when the
// recipe is not ready, and the route that opens a new one. The recipe read is stood in for, so each test says what it answers.

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

const mockRecipeState: { current: RecipeState } = { current: { status: "loading" } };
const mockUseRecipe = jest.fn();
// Whether the account has accepted the current Terms, which nothing is read before.
const mockReadsEnabled = { current: true };

jest.mock("../../lib/useReadsEnabled", () => ({
  useReadsEnabled: () => mockReadsEnabled.current,
}));

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useRecipe: (...parameters: unknown[]) => {
    mockUseRecipe(...parameters);
    return mockRecipeState.current;
  },
  useCreateRecipe: () => ({ mutateAsync: jest.fn() }),
  useUpdateRecipe: () => ({ mutateAsync: jest.fn() }),
}));

setUpTests();

const RECIPE_ID = "55555555-5555-4555-8555-555555555555";
const golden = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });

const readyState: RecipeState = {
  status: "ready",
  recipe: {
    id: RECIPE_ID,
    name: "Chicken and rice",
    servings: golden.servings,
    yield_grams: golden.yieldGrams,
    instructions: [],
    ingredients: golden.ingredients.map((ingredient, position) => ({ ...ingredient, position })),
    is_archived: false,
    computed: {
      total: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 },
      perServing: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 },
      per100g: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 },
      totalGrams: 720,
      effectiveGrams: 1100,
      engineVersion: 1,
    },
  },
};

let queryClient: QueryClient;

async function showRoute(route: "edit" | "new", parameters: Record<string, string | string[]>) {
  routerMock.searchParams = parameters;
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>{route === "edit" ? <EditRecipeRoute /> : <NewRecipeRoute />}</ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

describe("the recipe editor's routes", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeEditor",
      "components/RecipeEditorScreen",
      "components/RecipeDetailsFields",
      "components/RecipeIngredientsSection",
      "components/PerServingCard",
      "components/FoodDetail",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    mockUseRecipe.mockReset();
    mockRecipeState.current = { status: "loading" };
    mockReadsEnabled.current = true;
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

  describe("a saved recipe", () => {
    it("should open the editor on the recipe once it has loaded", async () => {
      mockRecipeState.current = readyState;
      await showRoute("edit", { id: RECIPE_ID });

      expect(await screen.findByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Name")).toHaveDisplayValue("Chicken and rice");
      expect(mockUseRecipe).toHaveBeenCalledWith(RECIPE_ID, expect.anything());
    });

    it.each([
      ["is loading", { status: "loading" }],
      ["failed to load", { status: "error", debugMessage: "raw database text" }],
      ["is not there", { status: "notFound" }],
    ] satisfies [string, RecipeState][])(
      "should replace itself with the recipe view, which has the states, when the recipe %s",
      async (_description, state) => {
        mockRecipeState.current = state;
        await showRoute("edit", { id: RECIPE_ID });

        expect(routerMock.replace).toHaveBeenCalledTimes(1);
        expect(routerMock.replace).toHaveBeenCalledWith(recipePath(RECIPE_ID));
        expect(screen.queryByLabelText("Name")).not.toBeOnTheScreen();
        expect(screen.queryByLabelText(RECIPE_EDITOR.loadingLabel)).not.toBeOnTheScreen();
        expect(screen.queryByText(GENERIC_ERROR)).not.toBeOnTheScreen();
      },
    );

    it("should send an id that cannot be a recipe to the view, and ask about nothing", async () => {
      await showRoute("edit", { id: "abc" });

      expect(routerMock.replace).toHaveBeenCalledWith(recipePath("abc"));
      expect(mockUseRecipe).toHaveBeenCalledWith(undefined, expect.anything());
    });

    it("should send the user to the view while the terms gate is up, even for a recipe the cache holds", async () => {
      mockRecipeState.current = readyState;
      mockReadsEnabled.current = false;
      await showRoute("edit", { id: RECIPE_ID });

      expect(routerMock.replace).toHaveBeenCalledWith(recipePath(RECIPE_ID));
      expect(screen.queryByLabelText("Name")).not.toBeOnTheScreen();
    });

    it("should not replace itself when the recipe is ready", async () => {
      mockRecipeState.current = readyState;
      await showRoute("edit", { id: RECIPE_ID });

      expect(routerMock.replace).not.toHaveBeenCalled();
    });
  });

  describe("a new recipe", () => {
    it("should open the empty editor", async () => {
      await showRoute("new", {});

      expect(screen.getByRole("heading", { name: "New recipe" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Name")).toHaveDisplayValue("");
    });

    it("should start with the name the library carried over", async () => {
      await showRoute("new", { name: "pasta" });

      expect(screen.getByLabelText("Name")).toHaveDisplayValue("pasta");
    });

    it("should use the first of a repeated name", async () => {
      await showRoute("new", { name: ["pasta", "rice"] });

      expect(screen.getByLabelText("Name")).toHaveDisplayValue("pasta");
    });
  });
});
