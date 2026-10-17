import { KeyLowProvider } from "@keylow/api-client";
import { describeEditRecipe } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { ExpoRoot } from "expo-router";
// Not the package's testing library entry, which swaps in Reanimated's mock for every test that loads it:
// the real Reanimated is what the bottom sheet of the menu needs.
import { getMockContext } from "expo-router/build/testing-library/mock-config";
import { Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { chickenAndRice, foodsAfterTheChickenEdit } from "./recipeRefreshFixtures";
import TabsLayout from "../../app/(tabs)/_layout";
import RecipesLayout from "../../app/(tabs)/recipes/_layout";
import RecipesRoute from "../../app/(tabs)/recipes/index";
import RecipeViewRoute from "../../app/recipes/[id]/index";
import RefreshRecipeRoute from "../../app/recipes/[id]/refresh";
import { RootNavigator } from "../../components/RootNavigator";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryBackend, resetDiaryBackend } from "../support/diaryBackend";
import {
  recipeRefreshClient,
  recipeRowOf,
  refreshBackend,
  resetRefreshBackend,
} from "../support/recipeRefreshBackend";

import type { QueryClient } from "@tanstack/react-query";

// Refresh ingredients, walked through the real router from the recipe view's More menu: the screen opens
// over the view, the servings chosen there stay while it is open and after Apply, and Apply, Cancel and Close
// all lead back to the view with nothing left busy. The real tab layout and recipe screens run over the fake
// database with the foods and the save of a refresh.

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
      <KeyLowProvider client={recipeRefreshClient} queryClient={queryClient}>
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
  "(tabs)/more": standIn("More"),
  "foods/index": standIn("Search"),
  "recipes/[id]/index": RecipeViewRoute,
  "recipes/[id]/refresh": RefreshRecipeRoute,
};

type User = ReturnType<typeof userEvent.setup>;

async function walkToTheView() {
  diaryBackend.recipes = [recipeRowOf(chickenAndRice)];
  refreshBackend.foods = foodsAfterTheChickenEdit;
  const user = userEvent.setup();
  await render(<ExpoRoot context={getMockContext(routes)} location="/recipes" />);
  await user.press(await screen.findByRole("button", { name: /^Chicken and rice,/ }));
  await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") });
  return user;
}

const servingsField = () => screen.getByRole("adjustable", { name: "Servings" });
const refreshHeading = () => screen.findByRole("heading", { name: "Refresh ingredients" });
const tabBar = () => screen.queryByLabelText("Main");

async function openRefresh(user: User) {
  await user.press(screen.getByRole("button", { name: "More" }));
  await user.press(
    await screen.findByRole("button", {
      name: "Refresh ingredients, Check your foods for changes",
    }),
  );
  await refreshHeading();
}

async function chooseSixServings(user: User) {
  await user.press(screen.getByRole("button", { name: "More servings" }));
  await user.press(screen.getByRole("button", { name: "More servings" }));
  expect(servingsField()).toHaveDisplayValue("6");
}

describe("Refresh ingredients, walked from the recipe view", () => {
  beforeEach(() => {
    resetDiaryBackend();
    resetRefreshBackend();
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  it("should open over the view with no tab bar, and show the change", async () => {
    const user = await walkToTheView();

    await openRefresh(user);

    expect(await screen.findByLabelText("Per serving, before and after")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
    expect(tabBar()).not.toBeOnTheScreen();
  });

  it("should keep the servings chosen on the view across Apply, with the card at 362 kcal and the toast", async () => {
    const user = await walkToTheView();
    await chooseSixServings(user);
    await openRefresh(user);

    await user.press(
      await screen.findByRole("button", {
        name: "Apply, Replaces the saved values of the changed ingredients",
      }),
    );

    expect(await screen.findByRole("status", { name: "Ingredients refreshed" })).toBeOnTheScreen();
    expect(
      await screen.findByRole("button", { name: describeEditRecipe("Chicken and rice") }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("heading", { name: "Refresh ingredients" })).not.toBeOnTheScreen();
    expect(servingsField()).toHaveDisplayValue("6");
    expect(screen.getByLabelText("Chicken breast fillets, 750 g")).toBeOnTheScreen();
    expect(screen.getByLabelText("Per serving")).toHaveTextContent(/^362kcal/);
    expect(refreshBackend.saves).toHaveLength(1);
    expect(tabBar()).not.toBeOnTheScreen();
  });

  it("should leave Cancel and Close with the servings kept, nothing written, and the menu item ready again", async () => {
    const user = await walkToTheView();
    await chooseSixServings(user);
    await openRefresh(user);
    await screen.findByRole("button", { name: "Cancel" });

    await user.press(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Refresh ingredients" })).not.toBeOnTheScreen();
    });
    expect(servingsField()).toHaveDisplayValue("6");
    expect(refreshBackend.saves).toHaveLength(0);

    // Back on the view, the menu's item works again and is not left busy by the last visit.
    await openRefresh(user);
    await user.press(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Refresh ingredients" })).not.toBeOnTheScreen();
    });
    expect(servingsField()).toHaveDisplayValue("6");
    expect(refreshBackend.saves).toHaveLength(0);
  });
});
