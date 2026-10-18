import { KeyLowProvider } from "@keylow/api-client";
import { describeEditRecipe } from "@keylow/core/copy";
import { computeRecipe } from "@keylow/core/recipes";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { ExpoRoot } from "expo-router";
// Not the package's testing library entry, which swaps in Reanimated's mock for every test that loads it:
// the real Reanimated is what the bottom sheet of the menu needs.
import { getMockContext } from "expo-router/build/testing-library/mock-config";
import { Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { chickenAndRiceRecipe } from "./recipeViewFixtures";
import TabsLayout from "../../app/(tabs)/_layout";
import RecipesLayout from "../../app/(tabs)/recipes/_layout";
import RecipesRoute from "../../app/(tabs)/recipes/index";
import RecipeViewRoute from "../../app/recipes/[id]/index";
import { RootNavigator } from "../../components/RootNavigator";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryBackend, resetDiaryBackend } from "../support/diaryBackend";
import { recipeWritesClient } from "../support/recipeWritesBackend";

import type { QueryClient } from "@tanstack/react-query";

// The View's More menu, walked through the real router: where Duplicate and Archive lead, and what Undo
// brings back. The real tab layout and recipe screens run over the fake database with the recipe writes.

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

setUpTests();

let queryClient: QueryClient;

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={recipeWritesClient} queryClient={queryClient}>
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
  "recipes/[id]/index": RecipeViewRoute,
};

async function walkFromLibrary() {
  diaryBackend.recipes = [
    {
      id: chickenAndRiceRecipe.id,
      name: chickenAndRiceRecipe.name,
      servings: chickenAndRiceRecipe.servings,
      yield_grams: chickenAndRiceRecipe.yield_grams,
      is_archived: false,
      instructions: chickenAndRiceRecipe.instructions,
      computed: computeRecipe({
        servings: chickenAndRiceRecipe.servings,
        yieldGrams: chickenAndRiceRecipe.yield_grams,
        ingredients: chickenAndRiceRecipe.ingredients,
      }),
    },
  ];
  const user = userEvent.setup();
  await render(<ExpoRoot context={getMockContext(routes)} location="/recipes" />);
  await user.press(await screen.findByRole("button", { name: /^Chicken and rice,/ }));
  await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") });
  return user;
}

const chooseFromMore = async (user: Awaited<ReturnType<typeof walkFromLibrary>>, name: RegExp) => {
  await user.press(screen.getByRole("button", { name: "More" }));
  await user.press(await screen.findByRole("button", { name }));
};
const duplicateItem = /^Duplicate, /;
const archiveItem = /^Archive, /;
const recipesHeading = () => screen.findByRole("heading", { name: "Recipes" });
const tabBar = () => screen.queryByLabelText("Main");

describe("the recipe view's More menu, walked", () => {
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

  describe("Duplicate", () => {
    it("should open the copy's own view with Recipe duplicated, and Undo go back to the original's view", async () => {
      const user = await walkFromLibrary();

      await chooseFromMore(user, duplicateItem);

      expect(
        await screen.findByRole("heading", { name: "Chicken and rice (copy)" }),
      ).toBeOnTheScreen();
      expect(await screen.findByRole("status", { name: "Recipe duplicated" })).toBeOnTheScreen();
      expect(tabBar()).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(
          screen.queryByRole("heading", { name: "Chicken and rice (copy)" }),
        ).not.toBeOnTheScreen();
      });
      expect(screen.getByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: describeEditRecipe("Chicken and rice") }),
      ).toBeOnTheScreen();
      expect(diaryBackend.recipes.find((row) => row["name"] === "Chicken and rice (copy)")).toEqual(
        expect.objectContaining({ is_archived: true }),
      );

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(await recipesHeading()).toBeOnTheScreen();
      expect(screen.getAllByRole("button", { name: /, open$/ })).toHaveLength(1);
    });

    it("should name a second copy of the original (copy 2) and open that view", async () => {
      const user = await walkFromLibrary();
      await chooseFromMore(user, duplicateItem);
      await screen.findByRole("heading", { name: "Chicken and rice (copy)" });
      await user.press(screen.getByRole("button", { name: "Back" }));
      await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") });

      await chooseFromMore(user, duplicateItem);

      expect(
        await screen.findByRole("heading", { name: "Chicken and rice (copy 2)" }),
      ).toBeOnTheScreen();
    });
  });

  describe("Archive", () => {
    it("should return to the library with Recipe archived, and Undo bring the recipe back", async () => {
      const user = await walkFromLibrary();

      await chooseFromMore(user, archiveItem);

      expect(await recipesHeading()).toBeOnTheScreen();
      expect(await screen.findByRole("status", { name: "Recipe archived" })).toBeOnTheScreen();
      expect(tabBar()).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Chicken and rice,/ })).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Undo" }));

      expect(await screen.findByRole("button", { name: /^Chicken and rice,/ })).toBeOnTheScreen();
      expect(diaryBackend.recipes[0]).toEqual(expect.objectContaining({ is_archived: false }));
    });
  });
});
