import "../support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { RECIPES_EMPTY, RECIPES_LIBRARY, describeEditRecipe } from "@keylow/core/copy";
import { computeRecipe } from "@keylow/core/recipes";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, router } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { chickenAndRiceRecipe, frittataRecipe } from "./recipeViewFixtures";
import TabsLayout from "../../app/(tabs)/_layout";
import RecipesLayout from "../../app/(tabs)/recipes/_layout";
import RecipesRoute from "../../app/(tabs)/recipes/index";
import EditRecipeRoute from "../../app/recipes/[id]/edit";
import RecipeViewRoute from "../../app/recipes/[id]/index";
import NewRecipeRoute from "../../app/recipes/new";
import { RootNavigator } from "../../components/RootNavigator";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  requestsTo,
  resetDiaryBackend,
} from "../support/diaryBackend";

import type { RecipeViewRecipe } from "../../components/RecipeView";
import type { FoodSearchResult, FoodWithPortionsState } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

// Saving an edited recipe, walked as a person walks it from the Recipes tab (KEY-408): the real tab layout and
// the real recipe screens under the real router and the app's own root stack, read through the real
// api-client over a fake database. The screens the tabs do not hold (More, the diary) are stand-ins, because
// this test is about the recipes path.

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
const mockOnionsRead: FoodWithPortionsState = {
  status: "ready",
  food: onions,
  portions: [
    buildFoodPortion({
      id: "a0000000-0000-4000-8000-000000000001",
      food_id: onions.id,
      label: "1 small",
      grams: 80,
      position: 0,
    }),
    buildFoodPortion({
      id: "a0000000-0000-4000-8000-000000000002",
      food_id: onions.id,
      label: "1 medium",
      grams: 110,
      position: 1,
      is_default: true,
    }),
  ],
};

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
  "(tabs)/recipes/_layout": RecipesLayout,
  "(tabs)/recipes/index": RecipesRoute,
  "(tabs)/train": standIn("Train screen"),
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

const pathOf = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { store } = require("expo-router/build/global-state/router-store") as {
    store: { getRouteInfo: () => { pathname: string } };
  };
  return store.getRouteInfo().pathname;
};

describe("saving an edited recipe", () => {
  beforeEach(() => {
    resetDiaryBackend();
    queryClient = createDiaryQueryClient();
    diaryBackend.recipes = [recipeRowOf(chickenAndRiceRecipe)];
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  async function openEditorFromLibrary() {
    const user = await walkFrom("/recipes");
    await user.press(await chickenRow());
    await user.press(
      await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") }),
    );
    expect(await screen.findByRole("button", { name: "Save" })).toBeOnTheScreen();
    return user;
  }

  it("should return to the view after adding an ingredient and saving", async () => {
    const user = await openEditorFromLibrary();

    await user.press(screen.getByRole("button", { name: "Add ingredient" }));
    await user.type(screen.getByRole("searchbox", { name: "Search foods" }), "onions");
    await user.press(
      await screen.findByRole("button", { name: "Onions, raw, 100 g, choose amount" }),
    );
    await user.press(screen.getByRole("button", { name: "Add to recipe" }));
    await user.press(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();
    expect(pathOf()).toBe(`/recipes/${chickenAndRiceRecipe.id}`);
  });

  it("should write the recipe once for a Save pressed twice in a row", async () => {
    const user = await openEditorFromLibrary();
    await user.type(screen.getByLabelText("Name"), " bowl");
    const save = screen.getByRole("button", { name: "Save" });

    await fireEvent.press(save);
    await fireEvent.press(save);

    expect(
      await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice bowl") }),
    ).toBeOnTheScreen();
    expect(requestsTo("save_recipe")).toBe(1);
    expect(rootStack()).toEqual(["(tabs)", "recipes/[id]/index:5555"]);
  });

  it("should return to the view after adding 2 medium onions and saving", async () => {
    const user = await openEditorFromLibrary();

    await user.press(screen.getByRole("button", { name: "Add ingredient" }));
    await user.type(screen.getByRole("searchbox", { name: "Search foods" }), "onions");
    await user.press(await screen.findByRole("button", { name: /^Onions, raw, .*choose amount$/ }));
    expect(screen.getByRole("radio", { name: "1 medium", checked: true })).toBeOnTheScreen();
    await user.clear(screen.getByLabelText(/^Amount/));
    await user.type(screen.getByLabelText(/^Amount/), "2");
    await user.press(screen.getByRole("button", { name: "Add to recipe" }));
    await user.press(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();
    expect(screen.getByText(/Onions, raw/)).toBeOnTheScreen();
  });

  it("should return to the view after changing the name and saving", async () => {
    const user = await openEditorFromLibrary();

    await user.type(screen.getByLabelText("Name"), " bowl");
    await user.press(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice bowl") }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();
  });
});

type NavState = {
  index: number;
  routes: { name: string; params?: { id?: string }; state?: NavState }[];
};

// The root stack's screens, below the router's own wrapper, as "name" or "name:id".
const rootStack = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { store } = require("expo-router/build/global-state/router-store") as {
    store: { state: NavState };
  };
  const root = store.state.routes[0]?.state;
  return (root?.routes ?? []).map((route) =>
    route.params?.id === undefined ? route.name : `${route.name}:${route.params.id.slice(0, 4)}`,
  );
};

async function addOnions(user: Awaited<ReturnType<typeof walkFrom>>) {
  await user.press(screen.getByRole("button", { name: "Add ingredient" }));
  await user.type(screen.getByRole("searchbox", { name: "Search foods" }), "onions");
  await user.press(await screen.findByRole("button", { name: /^Onions, raw, .*choose amount$/ }));
  await user.press(screen.getByRole("button", { name: "Add to recipe" }));
}

describe("every way into the editor of a saved recipe", () => {
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

  it("new recipe, Save, Edit, add, Save: back on the view, then the library", async () => {
    const user = await walkFrom("/recipes");
    await screen.findByText(RECIPES_EMPTY.title);
    await pressEmptyStateNewRecipe(user);
    await user.type(await screen.findByLabelText("Name"), "Onion soup");
    await addOnions(user);
    await user.press(screen.getByRole("button", { name: "Save" }));
    await user.press(await screen.findByRole("button", { name: describeEditRecipe("Onion soup") }));
    await screen.findByRole("button", { name: "Save" });
    expect(rootStack()).toEqual(["(tabs)", "recipes/[id]/index:7777", "recipes/[id]/edit:7777"]);

    await addOnions(user);
    await user.press(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByRole("button", { name: describeEditRecipe("Onion soup") }),
    ).toBeOnTheScreen();
    expect(rootStack()).toEqual(["(tabs)", "recipes/[id]/index:7777"]);
    await user.press(screen.getByRole("button", { name: "Back" }));
    expect(await recipesHeading()).toBeOnTheScreen();
    expect(tabBar()).toBeOnTheScreen();
    expect(rootStack()).toEqual(["(tabs)"]);
  });

  it("view, Edit, Save, Edit again, add, Save: back on the view each time", async () => {
    diaryBackend.recipes = [recipeRowOf(chickenAndRiceRecipe)];
    const user = await walkFrom("/recipes");
    await user.press(await chickenRow());
    for (let round = 0; round < 2; round += 1) {
      await user.press(
        await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") }),
      );
      await screen.findByRole("button", { name: "Save" });
      await addOnions(user);
      await user.press(screen.getByRole("button", { name: "Save" }));
      expect(
        await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") }),
      ).toBeOnTheScreen();
      expect(rootStack()).toEqual(["(tabs)", "recipes/[id]/index:5555"]);
    }
  });

  it("two views stacked (as Duplicate leaves them), Edit the top one, add, Save: back on it, then the first", async () => {
    diaryBackend.recipes = [recipeRowOf(chickenAndRiceRecipe), recipeRowOf(frittataRecipe)];
    const user = await walkFrom("/recipes");
    await user.press(await chickenRow());
    await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") });
    await act(() => {
      router.push(`/recipes/${frittataRecipe.id}`);
    });
    await user.press(
      await screen.findByRole("button", { name: describeEditRecipe(frittataRecipe.name) }),
    );
    await screen.findByRole("button", { name: "Save" });
    expect(rootStack()).toEqual([
      "(tabs)",
      "recipes/[id]/index:5555",
      "recipes/[id]/index:6666",
      "recipes/[id]/edit:6666",
    ]);

    await addOnions(user);
    await user.press(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByRole("button", { name: describeEditRecipe(frittataRecipe.name) }),
    ).toBeOnTheScreen();
    expect(rootStack()).toEqual(["(tabs)", "recipes/[id]/index:5555", "recipes/[id]/index:6666"]);
    await user.press(screen.getByRole("button", { name: "Back" }));
    expect(
      await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") }),
    ).toBeOnTheScreen();
  });

  it("Save and the Android back in the same frame: leaves once, onto the view", async () => {
    diaryBackend.recipes = [recipeRowOf(chickenAndRiceRecipe)];
    const user = await walkFrom("/recipes");
    await user.press(await chickenRow());
    await user.press(
      await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") }),
    );
    await screen.findByRole("button", { name: "Save" });
    await addOnions(user);

    await act(() => {
      void fireEvent.press(screen.getByRole("button", { name: "Save" }));
      router.back();
      router.back();
    });

    expect(
      await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") }),
    ).toBeOnTheScreen();
    expect(rootStack()).toEqual(["(tabs)", "recipes/[id]/index:5555"]);
  });

  it("a cold link to the editor: the editor gives way to the view", async () => {
    diaryBackend.recipes = [recipeRowOf(chickenAndRiceRecipe)];
    await walkFrom(`/recipes/${chickenAndRiceRecipe.id}/edit`);

    expect(
      await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") }),
    ).toBeOnTheScreen();
    expect(rootStack()).toEqual(["recipes/[id]/index:5555"]);
  });
});
