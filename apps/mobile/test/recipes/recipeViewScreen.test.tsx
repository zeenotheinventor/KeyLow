import { KeyLowProvider, keys } from "@keylow/api-client";
import { GENERIC_ERROR, RECIPE_EDITOR, RECIPE_NOT_FOUND, RETRY_LABEL } from "@keylow/core/copy";
import { computeRecipe } from "@keylow/core/recipes";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { CHICKEN_AND_RICE_ID, chickenAndRiceRecipe, frittataRecipe } from "./recipeViewFixtures";
import RecipeViewRoute from "../../app/recipes/[id]/index";
import { ToastProvider } from "../../components/ui";
import { isPersistedQuery } from "../../lib/diaryCache/isPersistedQuery";
import { recipesPath } from "../../lib/recipeRoutes";
import { ThemeProvider } from "../../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  requestsTo,
  resetDiaryBackend,
} from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RecipeViewRecipe } from "../../components/RecipeView";
import type { QueryClient } from "@tanstack/react-query";

// The route that opens a recipe on its view, read through the real api-client over a fake database: the
// states around the view, and that reading a recipe leaves nothing on the phone and writes nothing.

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

// Whether the account has accepted the current Terms, before which nothing of the account is read or drawn.
const mockReadsEnabled = { current: true };

jest.mock("../../lib/useReadsEnabled", () => ({
  useReadsEnabled: () => mockReadsEnabled.current,
}));

setUpTests();

// A recipe as the database holds it: the library's columns, the steps, and the ingredients with their place.
function recipeRowOf(recipe: RecipeViewRecipe, isArchived = false) {
  return {
    id: recipe.id,
    name: recipe.name,
    servings: recipe.servings,
    yield_grams: recipe.yield_grams,
    is_archived: isArchived,
    instructions: recipe.instructions,
    computed: computeRecipe({
      servings: recipe.servings,
      yieldGrams: recipe.yield_grams,
      ingredients: recipe.ingredients,
    }),
    recipe_ingredients: recipe.ingredients.map((ingredient, position) => ({
      ...ingredient,
      position,
    })),
  };
}

let queryClient: QueryClient;

async function showRoute(id: string) {
  routerMock.searchParams = { id };
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <RecipeViewRoute />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

describe("the recipe view's route", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeView",
      "components/RecipeViewScreen",
      "components/RecipeLoadState",
      "components/ServingsCard",
      "components/RecipeViewIngredientsSection",
      "components/RecipeViewStepsSection",
      "components/StepRow",
      "components/PerServingCard",
      "components/FoodDetail",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
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

  describe("a recipe that is there", () => {
    it("should open the view on it, with the steps and the Per serving card", async () => {
      diaryBackend.recipes = [recipeRowOf(chickenAndRiceRecipe)];
      await showRoute(CHICKEN_AND_RICE_ID);

      expect(await screen.findByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Edit Chicken and rice" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Chicken breast fillets, 500 g")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Instructions · 5" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Per serving")).toHaveTextContent(/^374kcal/);
    });

    it("should open an archived recipe like a live one, with nothing drawn for it", async () => {
      diaryBackend.recipes = [recipeRowOf(frittataRecipe, true)];
      await showRoute(frittataRecipe.id);

      expect(
        await screen.findByRole("heading", { name: "Spinach and cheddar frittata" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByLabelText("Eggs, chicken, whole, raw, 6 × 1 large (300 g)"),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/archived/i)).not.toBeOnTheScreen();
    });

    it("should read the recipe and the library, and write nothing however the servings change", async () => {
      diaryBackend.recipes = [recipeRowOf(chickenAndRiceRecipe)];
      const user = await showRoute(CHICKEN_AND_RICE_ID);
      await screen.findByRole("heading", { name: "Chicken and rice" });

      await user.press(screen.getByRole("button", { name: "More servings" }));
      await user.press(screen.getByRole("button", { name: "Fewer servings" }));
      await user.press(screen.getByRole("button", { name: "Fewer servings" }));

      // The recipe, and the library its Duplicate names a copy from.
      expect(diaryBackend.requests.filter((request) => request.table === "recipes")).toEqual([
        expect.objectContaining({ method: "GET" }),
        expect.objectContaining({ method: "GET" }),
      ]);
      expect(diaryBackend.requests.every((request) => request.method === "GET")).toBe(true);
      expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    });

    it("should leave the recipe out of the cache kept on the phone", async () => {
      diaryBackend.recipes = [recipeRowOf(chickenAndRiceRecipe)];
      await showRoute(CHICKEN_AND_RICE_ID);
      await screen.findByRole("heading", { name: "Chicken and rice" });

      const query = queryClient.getQueryCache().find({
        queryKey: keys.recipes.detail(CHICKEN_AND_RICE_ID),
      });

      expect(query?.state.status).toBe("success");
      expect(query === undefined ? true : isPersistedQuery(query)).toBe(false);
    });

    it("should go back, or to the library when there is nothing to go back to", async () => {
      diaryBackend.recipes = [recipeRowOf(chickenAndRiceRecipe)];
      const user = await showRoute(CHICKEN_AND_RICE_ID);
      await screen.findByRole("heading", { name: "Chicken and rice" });

      await user.press(screen.getByRole("button", { name: "Back" }));
      expect(routerMock.back).toHaveBeenCalledTimes(1);

      routerMock.canGoBack.mockReturnValue(false);
      await user.press(screen.getByRole("button", { name: "Back" }));
      expect(routerMock.replace).toHaveBeenCalledWith(recipesPath());
    });
  });

  describe("while the terms gate is up", () => {
    it("should ask for nothing and draw nothing of the recipe", async () => {
      mockReadsEnabled.current = false;
      diaryBackend.recipes = [recipeRowOf(chickenAndRiceRecipe)];
      await showRoute(CHICKEN_AND_RICE_ID);

      expect(
        await screen.findByRole("status", { name: RECIPE_EDITOR.loadingLabel }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Chicken and rice" })).not.toBeOnTheScreen();
      expect(requestsTo("recipes")).toBe(0);
    });

    it("should not draw a recipe the cache already holds", async () => {
      diaryBackend.recipes = [recipeRowOf(chickenAndRiceRecipe)];
      await showRoute(CHICKEN_AND_RICE_ID);
      await screen.findByRole("heading", { name: "Chicken and rice" });

      mockReadsEnabled.current = false;
      await cleanup();
      await showRoute(CHICKEN_AND_RICE_ID);

      expect(screen.queryByRole("heading", { name: "Chicken and rice" })).not.toBeOnTheScreen();
      expect(screen.getByRole("status", { name: RECIPE_EDITOR.loadingLabel })).toBeOnTheScreen();
    });
  });

  describe("a recipe that is not there yet", () => {
    it("should show the Recipe header and a loading region, with no Edit", async () => {
      diaryBackend.hungTables.add("recipes");
      await showRoute(CHICKEN_AND_RICE_ID);

      expect(
        await screen.findByRole("status", { name: RECIPE_EDITOR.loadingLabel }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: RECIPE_EDITOR.loadingTitle })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeOnTheScreen();
    });

    it("should say something went wrong, without the failure, and ask again on Try again", async () => {
      diaryBackend.failingTables.add("recipes");
      const user = await showRoute(CHICKEN_AND_RICE_ID);

      expect(await screen.findByText(GENERIC_ERROR)).toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeOnTheScreen();
      const askedBefore = requestsTo("recipes");

      diaryBackend.failingTables.clear();
      diaryBackend.recipes = [recipeRowOf(chickenAndRiceRecipe)];
      await user.press(screen.getByRole("button", { name: RETRY_LABEL }));

      expect(await screen.findByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      expect(requestsTo("recipes")).toBeGreaterThan(askedBefore);
    });

    it("should say the recipe is not found when there is none", async () => {
      await showRoute(CHICKEN_AND_RICE_ID);

      expect(await screen.findByText(RECIPE_NOT_FOUND.title)).toBeOnTheScreen();
      expect(screen.getByText(RECIPE_NOT_FOUND.body)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
    });

    it("should say not found at once for an id that cannot be a recipe, and ask about nothing", async () => {
      await showRoute("abc");

      expect(await screen.findByText(RECIPE_NOT_FOUND.title)).toBeOnTheScreen();
      expect(requestsTo("recipes")).toBe(0);
    });

    it("should show the failed state offline with nothing in memory, as a read that cannot be made never ends", async () => {
      await act(() => {
        onlineManager.setOnline(false);
      });
      await showRoute(CHICKEN_AND_RICE_ID);

      expect(await screen.findByText(GENERIC_ERROR)).toBeOnTheScreen();
      expect(requestsTo("recipes")).toBe(0);
    });
  });
});
