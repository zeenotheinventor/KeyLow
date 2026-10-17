import "../support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { RECIPES_EMPTY, RECIPES_LIBRARY, describeEditRecipe } from "@keylow/core/copy";
import { computeRecipe } from "@keylow/core/recipes";
import { buildFood } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { chickenAndRiceRecipe } from "./recipeViewFixtures";
import TabsLayout from "../../app/(tabs)/_layout";
import RecipesRoute from "../../app/(tabs)/recipes";
import EditRecipeRoute from "../../app/recipes/[id]/edit";
import RecipeViewRoute from "../../app/recipes/[id]/index";
import NewRecipeRoute from "../../app/recipes/new";
import { RootNavigator } from "../../components/RootNavigator";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import {
  SAVED_RECIPE_ID,
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  resetDiaryBackend,
} from "../support/diaryBackend";

import type { RecipeViewRecipe } from "../../components/RecipeView";
import type { FoodSearchResult, FoodWithPortionsState } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

// The Recipes tab, walked as a person walks it: the real tab layout and the real recipe screens under the
// real router and the app's own root stack, read through the real api-client over a fake database. The
// screens the tabs do not hold (More, the diary) are stand-ins, because this test is about the recipes path.

jest.mock("../../global.css", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));

// The food search and the food's own read are Edge Function calls and a search over the foods, which this
// walk is not about, so they are stood in for with one food: onions.
const onions = buildFood({
  id: "44444444-4444-4444-8444-444444444444",
  source: "cofid",
  name: "Onions, raw",
  kcal: 35,
  protein_g: 1,
  carbs_g: 8,
  fat_g: 0.1,
});
const mockFoodSearch: FoodSearchResult = {
  local: [
    {
      id: onions.id,
      source: onions.source,
      name: onions.name,
      brand: onions.brand,
      basis: onions.basis,
      kcal: onions.kcal,
      protein_g: onions.protein_g,
      fat_g: onions.fat_g,
      carbs_g: onions.carbs_g,
      fibre_g: onions.fibre_g,
      quality: onions.quality,
      default_portion_id: null,
      default_portion_label: null,
      default_portion_grams: null,
      default_portion_ml: null,
      score: 0.9,
    },
  ],
  off: [],
  isLoadingLocal: false,
  isLoadingOff: false,
  isDebouncing: false,
  offError: null,
  localError: null,
};
const mockOnionsRead: FoodWithPortionsState = { status: "ready", food: onions, portions: [] };

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useFoodSearch: () => mockFoodSearch,
  useFoodWithPortions: () => mockOnionsRead,
  useRecentFoods: () => ({ data: [], isPending: false, isError: false }),
}));

setUpTests();

let queryClient: QueryClient;

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <RootNavigator />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
}

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

const routes = {
  _layout: Providers,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/dashboard": standIn("Dashboard"),
  "(tabs)/diary": standIn("Diary"),
  "(tabs)/recipes": RecipesRoute,
  "(tabs)/more": standIn("More"),
  "foods/index": standIn("Search"),
  "recipes/new": NewRecipeRoute,
  "recipes/[id]/index": RecipeViewRoute,
  "recipes/[id]/edit": EditRecipeRoute,
};

// A recipe as the database holds it: the library's columns, the steps, and the ingredients with their place.
function recipeRowOf(recipe: RecipeViewRecipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    servings: recipe.servings,
    yield_grams: recipe.yield_grams,
    is_archived: false,
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

async function walkFrom(location: string) {
  const user = userEvent.setup();
  await render(<ExpoRoot context={getMockContext(routes)} location={location} />);
  return user;
}

// The header has a New recipe and the empty state has the primary one; each opens the editor.
async function pressEmptyStateNewRecipe(user: Awaited<ReturnType<typeof walkFrom>>) {
  const [, emptyStateButton] = screen.getAllByRole("button", { name: RECIPES_LIBRARY.newRecipe });
  if (emptyStateButton === undefined) {
    throw new Error("The empty library should have a primary New recipe button");
  }
  await user.press(emptyStateButton);
}

const tabBar = () => screen.queryByLabelText("Main");
const recipesHeading = () => screen.findByRole("heading", { name: "Recipes" });
const chickenRow = () => screen.findByRole("button", { name: /^Chicken and rice,/ });

describe("walking the Recipes tab", () => {
  beforeEach(() => {
    resetDiaryBackend();
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("with no recipes", () => {
    it("should say there are none, with a New recipe to start one", async () => {
      await walkFrom("/recipes");

      expect(await screen.findByText(RECIPES_EMPTY.title)).toBeOnTheScreen();
      expect(screen.getAllByRole("button", { name: RECIPES_LIBRARY.newRecipe })).toHaveLength(2);
      expect(screen.queryByText("Coming soon")).not.toBeOnTheScreen();
    });

    it("should open the editor from New recipe and come back to the library on Close", async () => {
      const user = await walkFrom("/recipes");
      await screen.findByText(RECIPES_EMPTY.title);

      await pressEmptyStateNewRecipe(user);
      expect(await screen.findByRole("heading", { name: "New recipe" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Save" })).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(await recipesHeading()).toBeOnTheScreen();
      expect(screen.getByText(RECIPES_EMPTY.title)).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "New recipe" })).not.toBeOnTheScreen();
    });
  });

  describe("making a recipe", () => {
    it("should save a new recipe with an ingredient, open its view, and list it when Back returns", async () => {
      const user = await walkFrom("/recipes");
      await screen.findByText(RECIPES_EMPTY.title);
      await pressEmptyStateNewRecipe(user);

      await user.type(await screen.findByLabelText("Name"), "Onion soup");
      await user.press(screen.getByRole("button", { name: "Add ingredient" }));
      await user.type(screen.getByRole("searchbox", { name: "Search foods" }), "onions");
      await user.press(
        await screen.findByRole("button", { name: "Onions, raw, 100 g, choose amount" }),
      );
      await user.press(screen.getByRole("button", { name: "Add to recipe" }));
      await user.press(screen.getByRole("button", { name: "Save" }));

      expect(
        await screen.findByRole("button", { name: describeEditRecipe("Onion soup") }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();
      expect(tabBar()).not.toBeOnTheScreen();
      expect(diaryBackend.recipes.map((recipe) => recipe["id"])).toEqual([SAVED_RECIPE_ID]);

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(await recipesHeading()).toBeOnTheScreen();
      expect(await screen.findByRole("button", { name: /^Onion soup,/ })).toBeOnTheScreen();
      expect(tabBar()).toBeOnTheScreen();
    });
  });

  describe("with a recipe", () => {
    beforeEach(() => {
      diaryBackend.recipes = [recipeRowOf(chickenAndRiceRecipe)];
    });

    it("should show the library under the tab bar, with the Recipes tab selected", async () => {
      await walkFrom("/recipes");

      expect(await chickenRow()).toBeOnTheScreen();
      expect(tabBar()).toBeOnTheScreen();
      expect(screen.getByRole("tab", { name: "Recipes", selected: true })).toBeOnTheScreen();
    });

    it("should open the recipe's view from its row, with the tab bar hidden", async () => {
      const user = await walkFrom("/recipes");

      await user.press(await chickenRow());

      expect(await screen.findByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: describeEditRecipe("Chicken and rice") }),
      ).toBeOnTheScreen();
      expect(tabBar()).not.toBeOnTheScreen();
    });

    it("should open the editor from Edit, go back to the view, then to the library with the tab bar", async () => {
      const user = await walkFrom("/recipes");
      await user.press(await chickenRow());

      await user.press(
        await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") }),
      );
      expect(await screen.findByRole("button", { name: "Save" })).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      expect(tabBar()).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Back" }));
      expect(
        await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(await recipesHeading()).toBeOnTheScreen();
      expect(await chickenRow()).toBeOnTheScreen();
      expect(tabBar()).toBeOnTheScreen();
      expect(screen.getByRole("tab", { name: "Recipes", selected: true })).toBeOnTheScreen();
    });
  });
});
