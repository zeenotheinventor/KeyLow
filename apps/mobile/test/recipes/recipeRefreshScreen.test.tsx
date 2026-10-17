import { KeyLowProvider, keys } from "@keylow/api-client";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import {
  REFRESH_RECIPE_ID,
  chickenAndRice,
  foodsAfterTheChickenEdit,
  foodsAsSaved,
  oilFood,
} from "./recipeRefreshFixtures";
import RefreshRecipeRoute from "../../app/recipes/[id]/refresh";
import { ToastProvider } from "../../components/ui";
import { isPersistedQuery } from "../../lib/diaryCache/isPersistedQuery";
import { recipePath, recipesPath } from "../../lib/recipeRoutes";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryBackend, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import {
  recipeRefreshClient,
  recipeRowOf,
  refreshBackend,
  resetRefreshBackend,
} from "../support/recipeRefreshBackend";

import type { QueryClient } from "@tanstack/react-query";

// The refresh screen over the real api-client and the real core diff, with a fake database: the figures it
// shows, what Apply writes and where it leads, and every state around it. The router is the mock, so a test
// reads where the screen asked to go; the walk through the real router is in recipeRefreshWalkThrough.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock("expo-router/react-navigation", () => ({ usePreventRemove: () => undefined }));
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

let queryClient: QueryClient;

async function showScreen(id = REFRESH_RECIPE_ID) {
  routerMock.searchParams = { id };
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={recipeRefreshClient} queryClient={queryClient}>
        <ToastProvider>
          <RefreshRecipeRoute />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

const applyName = "Apply, Replaces the saved values of the changed ingredients";
const applyButton = () => screen.findByRole("button", { name: applyName });
const figure = (name: string) => screen.getByRole("group", { name });
const recipeReads = () =>
  diaryBackend.requests.filter(
    (request) => request.table === "recipes" && request.method === "GET",
  );

function seed(foods = foodsAfterTheChickenEdit) {
  diaryBackend.recipes = [recipeRowOf(chickenAndRice)];
  refreshBackend.foods = foods;
}

describe("the refresh screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeRefreshScreen",
      "components/RecipeRefreshContent",
      "components/BeforeAfterRow",
      "components/ChangedIngredientCard",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    resetRefreshBackend();
    mockReadsEnabled.current = true;
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
    jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.restoreAllMocks();
  });

  describe("the diff", () => {
    it("should lead with the header, the intro and the Per serving card before and after", async () => {
      seed();
      await showScreen();

      // The header is there from the first render, so the diff is waited for before the rest is read.
      expect(
        await screen.findByText(
          "These foods have changed since you added them. Apply to use their values now.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Refresh ingredients" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
      const card = within(screen.getByLabelText("Per serving, before and after"));
      expect(card.getByRole("heading", { name: "Per serving" })).toBeOnTheScreen();
      expect(card.getByRole("group", { name: "Calories, 374 before, 362 now" })).toBeOnTheScreen();
      expect(card.getByRole("group", { name: "Protein, 32 before, 35 now" })).toBeOnTheScreen();
      expect(card.getByRole("group", { name: "Carbs, 43 grams, no change" })).toBeOnTheScreen();
      expect(card.getByRole("group", { name: "Fat, 8.1 before, 6.8 now" })).toBeOnTheScreen();
    });

    it("should write the new value with its unit once, and an unchanged one with no change after it", async () => {
      seed();
      await showScreen();
      await screen.findByLabelText("Per serving, before and after");

      const calories = within(figure("Calories, 374 before, 362 now"));
      expect(calories.getByText("374")).toBeOnTheScreen();
      expect(calories.getByText("362 kcal")).toBeOnTheScreen();
      const carbs = within(figure("Carbs, 43 grams, no change"));
      expect(carbs.getByText("43 g")).toBeOnTheScreen();
      expect(carbs.getByText("no change")).toBeOnTheScreen();
    });

    it("should show the changed ingredient with where its food comes from, its amount and its figures", async () => {
      seed();
      await showScreen();

      expect(await screen.findByRole("heading", { name: "Changed · 1" })).toBeOnTheScreen();
      const card = within(screen.getByLabelText("Chicken breast fillets"));
      expect(await card.findByText("Yours")).toBeOnTheScreen();
      expect(card.getByText("500 g")).toBeOnTheScreen();
      expect(card.getByRole("group", { name: "Calories, 600 before, 550 now" })).toBeOnTheScreen();
      expect(card.getByText("Per 100 g")).toBeOnTheScreen();
      expect(card.getByRole("group", { name: "Energy, 120 before, 110 now" })).toBeOnTheScreen();
      expect(card.getByRole("group", { name: "Protein, 23 before, 25 now" })).toBeOnTheScreen();
      expect(card.getByRole("group", { name: "Fat, 2.1 before, 1 now" })).toBeOnTheScreen();
      // Carbs were 0 and are 0, so they are not listed.
      expect(card.queryByRole("group", { name: /^Carbohydrate/ })).not.toBeOnTheScreen();
    });

    it("should still show the changed ingredient, without a badge, when its food cannot be read for it", async () => {
      seed();
      // The three reads of the check come first, and the card's own read is the fourth.
      refreshBackend.failsFoodReadsAfter = 3;
      await showScreen();

      const card = within(await screen.findByLabelText("Chicken breast fillets"));
      expect(card.getByRole("group", { name: "Calories, 600 before, 550 now" })).toBeOnTheScreen();
      expect(card.getByText("500 g")).toBeOnTheScreen();
      await waitFor(() => {
        expect(diaryBackend.requests.filter((request) => request.table === "foods")).toHaveLength(
          4,
        );
      });
      expect(card.queryByText("Yours")).not.toBeOnTheScreen();
      expect(await applyButton()).toBeEnabled();
    });

    it("should list the ingredients that did not change, plainly, with their amounts", async () => {
      seed();
      await showScreen();

      expect(await screen.findByRole("heading", { name: "Unchanged · 2" })).toBeOnTheScreen();
      const list = within(screen.getByLabelText("Unchanged"));
      expect(list.getByLabelText("Long grain rice, 200 g")).toBeOnTheScreen();
      expect(list.getByLabelText("Olive oil, 20 g")).toBeOnTheScreen();
    });

    it("should pin Apply and Cancel, with Apply's hint in its name", async () => {
      seed();
      await showScreen();

      expect(await applyButton()).toBeEnabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    });

    it("should start a screen reader on the intro once, so the change is read before the buttons", async () => {
      seed();
      // The accessibility module is a mock the whole file shares, so the calls of earlier tests are put away.
      jest.mocked(AccessibilityInfo.sendAccessibilityEvent).mockClear();
      await showScreen();
      await applyButton();

      expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledTimes(1);
      expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledWith(
        expect.anything(),
        "focus",
      );
    });

    it("should say that a portion the food no longer has became a plain amount", async () => {
      const onions = buildFood({
        id: "00000000-0000-4000-8000-0000000000d1",
        source: "user",
        name: "Onions, raw",
        kcal: 35,
        protein_g: 1,
        carbs_g: 8,
        fat_g: 0.1,
      });
      const mediumOnion = buildFoodPortion({
        id: "00000000-0000-4000-8000-0000000000d2",
        food_id: onions.id,
        label: "1 medium",
        grams: 110,
      });
      diaryBackend.recipes = [
        recipeRowOf({
          ...chickenAndRice,
          ingredients: [
            buildRecipeIngredient(onions, { quantity: 1, unit: "portion", portion: mediumOnion }),
          ],
        }),
      ];
      // The onion changed and its medium portion is gone.
      refreshBackend.foods = [{ ...onions, kcal: 40 }];
      refreshBackend.portions = [];
      await showScreen();

      expect(
        await screen.findByText("1 medium is no longer on this food, so the amount becomes 110 g."),
      ).toBeOnTheScreen();
    });
  });

  describe("Apply", () => {
    it("should save once, say Ingredients refreshed and go back to the view", async () => {
      seed();
      const user = await showScreen();

      await user.press(await applyButton());

      expect(
        await screen.findByRole("status", { name: "Ingredients refreshed" }),
      ).toBeOnTheScreen();
      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
      expect(refreshBackend.saves).toHaveLength(1);
      // The chicken is rebuilt from its food as it is now, and the other two are kept as they were.
      expect(diaryBackend.recipes[0]).toMatchObject({
        recipe_ingredients: [{ snapshot: { per100: { kcal: 110, protein_g: 25 } } }, {}, {}],
      });
    });

    it("should still go back when the refetch after the save says nothing is left to refresh", async () => {
      seed();
      const user = await showScreen();
      await applyButton();
      const readsBefore = recipeReads().length;

      await user.press(await applyButton());

      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
      // The save read the recipe, saved it and read it back, and the preview was read once more after.
      await waitFor(() => {
        expect(recipeReads().length).toBeGreaterThanOrEqual(readsBefore + 3);
      });
      expect(screen.queryByText("Nothing to refresh")).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Changed · 1" })).toBeOnTheScreen();
    });

    it("should act once for a double tap", async () => {
      seed();
      refreshBackend.isHoldingSaves = true;
      await showScreen();
      const apply = await applyButton();

      await act(async () => {
        await fireEvent.press(apply);
        await fireEvent.press(apply);
      });
      await waitFor(() => {
        expect(refreshBackend.held).toHaveLength(1);
      });
      await act(() => {
        refreshBackend.held.forEach((release) => {
          release();
        });
      });

      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
      expect(refreshBackend.saves).toHaveLength(1);
    });

    it("should not respond to Close or Cancel while it is saving", async () => {
      seed();
      refreshBackend.isHoldingSaves = true;
      const user = await showScreen();
      await user.press(await applyButton());
      await waitFor(() => {
        expect(refreshBackend.held).toHaveLength(1);
      });

      expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      expect(routerMock.back).not.toHaveBeenCalled();
    });

    it("should stay, say one fixed sentence and leave Apply ready when the save fails", async () => {
      seed();
      refreshBackend.failsSave = true;
      const user = await showScreen();

      await user.press(await applyButton());

      expect(
        await screen.findByText("Not saved. Check your connection and try again."),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
      expect(screen.queryByRole("status", { name: "Ingredients refreshed" })).not.toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(await applyButton()).toBeEnabled();
      expect(screen.getByRole("heading", { name: "Changed · 1" })).toBeOnTheScreen();
    });

    it("should do nothing more once it has saved, until the screen has gone", async () => {
      seed();
      const user = await showScreen();
      await user.press(await applyButton());
      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });

      // The mock router leaves the screen up, as the real one does until its animation ends.
      await user.press(await applyButton());
      await user.press(screen.getByRole("button", { name: "Close" }));
      await user.press(screen.getByRole("button", { name: "Cancel" }));

      expect(refreshBackend.saves).toHaveLength(1);
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should save on a second try after a failure, and take the sentence down", async () => {
      seed();
      refreshBackend.failsSave = true;
      const user = await showScreen();
      await user.press(await applyButton());
      await screen.findByText("Not saved. Check your connection and try again.");
      refreshBackend.failsSave = false;

      await user.press(await applyButton());

      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
      expect(
        screen.queryByText("Not saved. Check your connection and try again."),
      ).not.toBeOnTheScreen();
    });

    it("should be dimmed and disabled offline, and save nothing", async () => {
      seed();
      const user = await showScreen();
      const apply = await applyButton();
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(apply);

      expect(apply).toBeDisabled();
      expect(refreshBackend.saves).toHaveLength(0);
      expect(routerMock.back).not.toHaveBeenCalled();
    });
  });

  describe("leaving without applying", () => {
    it("should go back from Cancel and write nothing", async () => {
      seed();
      const user = await showScreen();
      await applyButton();

      await user.press(screen.getByRole("button", { name: "Cancel" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(refreshBackend.saves).toHaveLength(0);
      expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    });

    it("should go back from Close and write nothing", async () => {
      seed();
      const user = await showScreen();
      await applyButton();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(refreshBackend.saves).toHaveLength(0);
    });

    it("should go to the recipe's view when there is nothing to go back to", async () => {
      seed();
      routerMock.canGoBack.mockReturnValue(false);
      const user = await showScreen();
      await applyButton();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.replace).toHaveBeenCalledWith(recipePath(REFRESH_RECIPE_ID));
      expect(routerMock.back).not.toHaveBeenCalled();
    });
  });

  describe("nothing changed", () => {
    it("should say so with Done and no Apply, and Done goes back", async () => {
      seed(foodsAsSaved);
      const user = await showScreen();

      expect(await screen.findByRole("heading", { name: "Nothing to refresh" })).toBeOnTheScreen();
      expect(screen.getByText("Every ingredient matches its food today.")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Apply/ })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Done" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(refreshBackend.saves).toHaveLength(0);
    });
  });

  describe("a food that has been deleted", () => {
    const withTheOilDeleted = [
      ...foodsAfterTheChickenEdit.slice(0, 2),
      { ...oilFood, deleted_at: "2026-10-16T09:00:00+00:00" },
    ];

    it("should keep the ingredient as it is, under its own heading, beside the changes", async () => {
      seed(withTheOilDeleted);
      await showScreen();

      expect(await screen.findByRole("heading", { name: "Kept as it is · 1" })).toBeOnTheScreen();
      expect(screen.getByText("Olive oil")).toBeOnTheScreen();
      expect(screen.getByText("20 g")).toBeOnTheScreen();
      expect(
        screen.getByText("This food has been deleted. The ingredient keeps its saved values."),
      ).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Unchanged · 1" })).toBeOnTheScreen();
      expect(
        within(screen.getByLabelText("Unchanged")).getByLabelText("Long grain rice, 200 g"),
      ).toBeOnTheScreen();
      expect(await applyButton()).toBeEnabled();
    });

    it("should show the kept ingredient above Nothing to refresh, with no Apply, when it is the only news", async () => {
      seed([...foodsAsSaved.slice(0, 2), { ...oilFood, deleted_at: "2026-10-16T09:00:00+00:00" }]);
      await showScreen();

      expect(await screen.findByRole("heading", { name: "Kept as it is · 1" })).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Nothing to refresh" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Apply/ })).not.toBeOnTheScreen();
    });

    it("should keep an ingredient whose food is not there at all", async () => {
      seed(foodsAfterTheChickenEdit.slice(0, 2));
      await showScreen();

      expect(await screen.findByRole("heading", { name: "Kept as it is · 1" })).toBeOnTheScreen();
    });
  });

  describe("loading", () => {
    it("should say Checking your foods, with no buttons but Close", async () => {
      seed();
      diaryBackend.hungTables.add("foods");
      await showScreen();

      expect(await screen.findByRole("status", { name: "Checking your foods" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Apply/ })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeOnTheScreen();
    });

    it("should ask for nothing while the terms gate is up", async () => {
      seed();
      mockReadsEnabled.current = false;
      await showScreen();

      expect(await screen.findByRole("status", { name: "Checking your foods" })).toBeOnTheScreen();
      expect(diaryBackend.requests).toHaveLength(0);
    });
  });

  describe("when the foods cannot be checked", () => {
    it("should say Couldn't check your foods with Try again, and show no raw text", async () => {
      seed();
      diaryBackend.failingTables.add("foods");
      await showScreen();

      expect(await screen.findByText("Couldn't check your foods")).toBeOnTheScreen();
      expect(screen.getByText("Check your connection and try again.")).toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Apply/ })).not.toBeOnTheScreen();
    });

    it("should check again with Try again", async () => {
      seed();
      diaryBackend.failingTables.add("foods");
      const user = await showScreen();
      await screen.findByText("Couldn't check your foods");
      diaryBackend.failingTables.clear();

      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(await applyButton()).toBeEnabled();
    });

    it("should leave with Close and write nothing", async () => {
      seed();
      diaryBackend.failingTables.add("foods");
      const user = await showScreen();
      await screen.findByText("Couldn't check your foods");

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(refreshBackend.saves).toHaveLength(0);
    });

    it("should show the error state when offline with nothing read yet", async () => {
      seed();
      diaryBackend.hungTables.add("foods");
      await act(() => {
        onlineManager.setOnline(false);
      });
      await showScreen();

      expect(await screen.findByText("Couldn't check your foods")).toBeOnTheScreen();
    });
  });

  describe("a recipe that is not there", () => {
    it("should say Recipe not found, with Close, when the recipe is not visible", async () => {
      diaryBackend.recipes = [];
      await showScreen();

      expect(await screen.findByRole("heading", { name: "Recipe not found" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Apply/ })).not.toBeOnTheScreen();
    });

    it("should ask for nothing for an address that cannot be a recipe, and close to the library", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = await showScreen("not-a-recipe");

      expect(await screen.findByRole("heading", { name: "Recipe not found" })).toBeOnTheScreen();
      expect(diaryBackend.requests).toHaveLength(0);

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.replace).toHaveBeenCalledWith(recipesPath());
    });
  });

  describe("what is kept", () => {
    it("should read the foods afresh each time it opens, never from an earlier open", async () => {
      seed();
      await showScreen();
      await applyButton();
      await cleanup();
      await waitFor(() => {
        expect(
          queryClient.getQueryCache().find({ queryKey: keys.recipes.refresh(REFRESH_RECIPE_ID) }),
        ).toBeUndefined();
      });
      const readsBefore = recipeReads().length;
      // The user has since put the chicken back, so there is nothing to refresh.
      refreshBackend.foods = foodsAsSaved;
      routerMock.searchParams = { id: REFRESH_RECIPE_ID };
      await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={recipeRefreshClient} queryClient={queryClient}>
            <ToastProvider>
              <RefreshRecipeRoute />
            </ToastProvider>
          </KeyLowProvider>
        </ThemeProvider>,
      );

      expect(await screen.findByRole("heading", { name: "Nothing to refresh" })).toBeOnTheScreen();
      expect(recipeReads().length).toBeGreaterThan(readsBefore);
    });

    it("should keep no recipe query in the cache kept on the phone", async () => {
      seed();
      await showScreen();
      await applyButton();

      const recipeQueries = queryClient
        .getQueryCache()
        .getAll()
        .filter((query) => query.queryKey[0] === "recipes");

      expect(recipeQueries.length).toBeGreaterThan(0);
      expect(recipeQueries.some((query) => isPersistedQuery(query))).toBe(false);
    });
  });
});
