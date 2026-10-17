import { buildRecipeLogEntry } from "@keylow/core/diary";
import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import {
  mockDeleteEntry,
  mockLogFood,
  mockLogRecipe,
  mockUseProfileTimeZone,
  profileTimeZone,
  recentFoods,
  resetApiClientMock,
  savedFoodId,
  termsAccepted,
} from "./support/apiClientMock";
import { compileFoodSearchStyles } from "./support/foodSearchStyles";
import {
  mockUseRecipeSearch,
  recipeSearchResult,
  resetSearchApiClientMock,
  searchResult,
} from "./support/searchApiClientMock";
import FoodSearchRoute from "../../app/foods/index";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";

import type { FoodSearchHit, RecentFood, RecipeLogEntry, RecipeSummary } from "@keylow/api-client";

// The log search with a recipe that matches: the "Your recipes" group and its plus, which logs one serving at
// once. The foods' own tests stay in logSearch.test.tsx, which this file does not touch.

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

setUpTests();

const recipeId = "00000000-0000-4000-8000-0000000000b1";
const otherRecipeId = "00000000-0000-4000-8000-0000000000b2";
const fillets = "88888888-8888-4888-8888-888888888888";
const grilled = "99999999-9999-4999-8999-999999999999";

// Chicken and rice as the board draws it: four servings of 275 g, 374 kcal, 32 P, 43 C, 8.1 F each.
const chickenAndRice: RecipeSummary = {
  id: recipeId,
  name: "Chicken and rice",
  servings: 4,
  yield_grams: 1100,
  is_archived: false,
  computed: {
    total: { kcal: 1496.8, protein_g: 126.5, carbs_g: 170.2, fat_g: 32.5, fibre_g: null },
    perServing: { kcal: 374.2, protein_g: 31.625, carbs_g: 42.55, fat_g: 8.125, fibre_g: null },
    per100g: { kcal: 136.1, protein_g: 11.5, carbs_g: 15.5, fat_g: 2.95, fibre_g: null },
    totalGrams: 720,
    effectiveGrams: 1100,
    engineVersion: 1,
  },
};

const rowName =
  "Chicken and rice, recipe, 1 serving 275 grams, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams";
const addName = "Add Chicken and rice, 1 serving (275 g)";
const notSaved = "Not saved. Check your connection and try again.";

function hit(changes: Partial<FoodSearchHit>): FoodSearchHit {
  return {
    id: fillets,
    source: "user",
    name: "Chicken breast fillets",
    brand: null,
    basis: "per_100g",
    kcal: 120,
    protein_g: 23,
    fat_g: 2.1,
    carbs_g: 0,
    fibre_g: null,
    quality: {},
    default_portion_id: null,
    default_portion_label: null,
    default_portion_grams: null,
    default_portion_ml: null,
    score: 0.9,
    ...changes,
  };
}

const chickenFillets = hit({});
const chickenGrilled = hit({
  id: grilled,
  source: "cofid",
  name: "Chicken breast, grilled",
  kcal: 148,
  score: 0.5,
});

// What the log stores for a tap, so Undo has an entry to remove.
function storedRecipeEntry(id: string): RecipeLogEntry {
  return {
    ...buildRecipeLogEntry({
      recipe: chickenAndRice,
      quantity: 1,
      unit: "serving",
      loggedAt: "2026-10-14T17:00:00.000Z",
      localDate: "2026-10-14",
    }),
    id,
    created_at: "2026-10-14T17:00:01.000Z",
    kcal: 374.2,
  };
}

async function renderLogSearch(params: { day?: string; time?: string } = {}) {
  routerMock.searchParams = { day: "2026-10-14", time: "18:00", ...params };
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <FoodSearchRoute />
      </ToastProvider>
    </ThemeProvider>,
  );
  return user;
}

async function type(text: string) {
  await fireEvent.changeText(screen.getByRole("searchbox", { name: "Search foods" }), text);
}

function showRecipes(recipes: RecipeSummary[]) {
  Object.assign(recipeSearchResult, { recipes });
}

function showFoods(local: FoodSearchHit[]) {
  Object.assign(searchResult, { local });
}

// The kit's list is not an accessibility element (its rows must be reachable one by one), so it is found by its label.
const recipeList = () => screen.getByLabelText("Your recipes, values per serving");

describe("recipes in the log search", () => {
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
    mockLogRecipe.mockResolvedValue(storedRecipeEntry("entry-recipe"));
    showRecipes([chickenAndRice]);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    onlineManager.setOnline(true);
  });

  describe("the group", () => {
    it("should be headed Your recipes, per serving, and named for a screen reader as its values are", async () => {
      await renderLogSearch();
      await type("chicken");

      expect(screen.getByRole("heading", { name: "Your recipes · Per serving" })).toBeOnTheScreen();
      expect(recipeList()).toBeOnTheScreen();
    });

    it("should come before Your foods and Common foods", async () => {
      showFoods([chickenGrilled, chickenFillets]);
      await renderLogSearch();
      await type("chicken");

      expectTextsInOrder(screen.getAllByRole("heading", { name: /^(Your|Common) / }), [
        "Your recipes · Per serving",
        "Your foods · Yours",
        "Common foods · UK CoFID",
      ]);
    });

    it("should be left out when no recipe matches", async () => {
      showRecipes([]);
      showFoods([chickenFillets]);
      await renderLogSearch();
      await type("chicken");

      expect(screen.queryByRole("heading", { name: /^Your recipes/ })).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Your foods · Yours" })).toBeOnTheScreen();
    });

    it("should be the only result when no food matches, with no empty state", async () => {
      await renderLogSearch();
      await type("chicken");

      expect(screen.getByRole("heading", { name: "Your recipes · Per serving" })).toBeOnTheScreen();
      expect(screen.queryByText("No foods found")).not.toBeOnTheScreen();
    });

    it("should not be drawn before the search is ready to say there are no foods", async () => {
      showRecipes([]);
      Object.assign(recipeSearchResult, { isDebouncing: true });
      await renderLogSearch();
      await type("chicken");

      expect(screen.queryByText("No foods found")).not.toBeOnTheScreen();
    });

    it("should never be in the idle list, which is Quick add and Recent", async () => {
      const recent: RecentFood = {
        foodId: savedFoodId,
        entryId: "entry-oats",
        loggedAt: "2026-10-14T07:05:00Z",
        portionId: null,
        snapshot: {
          v: 1,
          kind: "food",
          ref: savedFoodId,
          name: "Porridge oats",
          basis: "per_100g",
          per100: { kcal: 374, protein_g: 11.2, fat_g: 8.4, carbs_g: 60.4, fibre_g: null },
          quantity: 50,
          unit: "g",
          portion: null,
          density: null,
          resolvedGrams: 50,
          engineVersion: 1,
        },
      };
      recentFoods.current = { data: [recent], isPending: false, isError: false };
      await renderLogSearch();

      expect(screen.getByRole("heading", { name: /^Recent/ })).toBeOnTheScreen();
      expect(screen.queryByText("Chicken and rice")).not.toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: /^Your recipes/ })).not.toBeOnTheScreen();
    });

    it("should not be asked for in the plain search, which only finds foods", async () => {
      routerMock.searchParams = {};
      await render(
        <ThemeProvider fixedPreference="dark">
          <FoodSearchRoute />
        </ThemeProvider>,
      );
      await type("chicken");

      expect(mockUseRecipeSearch).not.toHaveBeenCalled();
      expect(screen.queryByRole("heading", { name: /^Your recipes/ })).not.toBeOnTheScreen();
    });
  });

  describe("what is asked for", () => {
    it("should ask for live recipes only, matching the text typed", async () => {
      await renderLogSearch();
      await type("chicken");

      const [query, options] = mockUseRecipeSearch.mock.lastCall ?? [];
      expect(query).toBe("chicken");
      expect(options?.archived).toBeUndefined();
    });

    it("should wait for the Terms before it reads anything", async () => {
      termsAccepted.current = false;
      await renderLogSearch();

      expect(mockUseRecipeSearch).toHaveBeenCalled();
      expect(
        mockUseRecipeSearch.mock.calls.every(([, options]) => options?.enabled === false),
      ).toBe(true);
    });

    it("should read once the Terms are accepted", async () => {
      await renderLogSearch();

      expect(mockUseRecipeSearch.mock.calls.every(([, options]) => options?.enabled === true)).toBe(
        true,
      );
    });
  });

  describe("a recipe that cannot be logged", () => {
    it("should not be listed when it has no weight, because one serving of it is nothing", async () => {
      showRecipes([
        {
          ...chickenAndRice,
          id: otherRecipeId,
          name: "Chicken stew",
          computed: { ...chickenAndRice.computed, effectiveGrams: 0 },
        },
      ]);
      await renderLogSearch();
      await type("chicken");

      expect(screen.queryByText("Chicken stew")).not.toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: /^Your recipes/ })).not.toBeOnTheScreen();
    });

    it.each([
      ["energy", { kcal: null }],
      ["protein", { protein_g: null }],
      ["carbohydrate", { carbs_g: null }],
      ["fat", { fat_g: null }],
    ])(
      "should not be listed when it is missing its %s, because its row would say Needs review with no plus",
      async (_name, missing) => {
        showRecipes([
          {
            ...chickenAndRice,
            computed: {
              ...chickenAndRice.computed,
              perServing: { ...chickenAndRice.computed.perServing, ...missing },
            },
          },
        ]);
        await renderLogSearch();
        await type("chicken");

        expect(screen.queryByText("Chicken and rice")).not.toBeOnTheScreen();
        expect(screen.queryByText("Needs review")).not.toBeOnTheScreen();
        expect(screen.queryByRole("heading", { name: /^Your recipes/ })).not.toBeOnTheScreen();
      },
    );

    it("should leave the others in the group", async () => {
      showRecipes([
        {
          ...chickenAndRice,
          id: otherRecipeId,
          name: "Chicken stew",
          computed: { ...chickenAndRice.computed, effectiveGrams: 0 },
        },
        chickenAndRice,
      ]);
      await renderLogSearch();
      await type("chicken");

      expect(screen.queryByText("Chicken stew")).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: addName })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Add Chicken stew/ })).not.toBeOnTheScreen();
    });
  });

  describe("the row", () => {
    it("should write the name with the match in bold, the serving, and the values of one serving", async () => {
      await renderLogSearch();
      await type("chicken");

      expect(screen.getByText("Chicken")).toHaveStyle({ fontFamily: "Geist-SemiBold" });
      expect(screen.getByText("and rice")).toHaveStyle({ fontFamily: "Geist-Regular" });
      expect(screen.getByText("1 serving (275 g)")).toBeOnTheScreen();
      expect(screen.getByText("374")).toBeOnTheScreen();
      expect(screen.getByText("32 P")).toBeOnTheScreen();
      expect(screen.getByText("43 C")).toBeOnTheScreen();
      expect(screen.getByText("8.1 F")).toBeOnTheScreen();
    });

    it("should be named by its values in words, and not offer to choose an amount", async () => {
      await renderLogSearch();
      await type("chicken");

      expect(screen.getByLabelText(rowName)).toBeOnTheScreen();
    });

    it("should not be pressable yet: its plus is the only button in the group", async () => {
      const user = await renderLogSearch();
      await type("chicken");

      expect(within(recipeList()).getAllByRole("button")).toHaveLength(1);
      await user.press(screen.getByLabelText(rowName));
      expect(routerMock.push).not.toHaveBeenCalled();
    });
  });

  describe("the plus", () => {
    it("should be named for the recipe and its serving", async () => {
      await renderLogSearch();
      await type("chicken");

      expect(screen.getByRole("button", { name: addName })).toBeOnTheScreen();
    });

    it("should log one serving once, at the hour the sheet was opened from", async () => {
      const user = await renderLogSearch({ day: "2026-10-14", time: "18:00" });
      await type("chicken");

      await user.press(screen.getByRole("button", { name: addName }));

      expect(mockLogRecipe).toHaveBeenCalledTimes(1);
      // 18:00 in London in October is 17:00 UTC.
      expect(mockLogRecipe.mock.calls[0]?.[0]).toMatchObject({
        recipe: chickenAndRice,
        quantity: 1,
        unit: "serving",
        loggedAt: "2026-10-14T17:00:00.000Z",
        localDate: "2026-10-14",
      });
      expect(mockLogFood).not.toHaveBeenCalled();
    });

    it("should log now when the sheet was opened from the dock, with a day and no hour", async () => {
      routerMock.searchParams = { day: "2026-10-15" };
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await render(
        <ThemeProvider fixedPreference="dark">
          <ToastProvider>
            <FoodSearchRoute />
          </ToastProvider>
        </ThemeProvider>,
      );
      await type("chicken");

      await user.press(screen.getByRole("button", { name: addName }));

      expect(mockLogRecipe.mock.calls[0]?.[0].loggedAt).toMatch(/^2026-10-15T11:40:30\./);
      expect(mockLogRecipe.mock.calls[0]?.[0].localDate).toBe("2026-10-15");
    });

    it("should leave the sheet open and say Added with the recipe's name", async () => {
      const user = await renderLogSearch();
      await type("chicken");

      await user.press(screen.getByRole("button", { name: addName }));

      expect(screen.getByText("Added Chicken and rice")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
      expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeOnTheScreen();
    });

    it("should remove only the entry it made on Undo", async () => {
      const user = await renderLogSearch();
      await type("chicken");
      await user.press(screen.getByRole("button", { name: addName }));

      await user.press(screen.getByRole("button", { name: "Undo" }));

      expect(mockDeleteEntry).toHaveBeenCalledTimes(1);
      expect(mockDeleteEntry).toHaveBeenCalledWith(storedRecipeEntry("entry-recipe"));
    });

    it("should log once however often it is pressed before the first has finished", async () => {
      let finish: (entry: RecipeLogEntry) => void = () => undefined;
      mockLogRecipe.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const user = await renderLogSearch();
      await type("chicken");

      await user.press(screen.getByRole("button", { name: addName }));
      await user.press(screen.getByRole("button", { name: addName }));
      await act(() => {
        finish(storedRecipeEntry("entry-recipe"));
      });

      expect(mockLogRecipe).toHaveBeenCalledTimes(1);
    });

    it("should log again once the first has finished", async () => {
      const user = await renderLogSearch();
      await type("chicken");

      await user.press(screen.getByRole("button", { name: addName }));
      await user.press(screen.getByRole("button", { name: addName }));

      expect(mockLogRecipe).toHaveBeenCalledTimes(2);
    });

    it("should log a food, and not the recipe, when the food's plus is pressed", async () => {
      showFoods([chickenFillets]);
      const user = await renderLogSearch();
      await type("chicken");

      await user.press(screen.getByRole("button", { name: "Add Chicken breast fillets, 100 g" }));

      expect(mockLogFood).toHaveBeenCalledTimes(1);
      expect(mockLogRecipe).not.toHaveBeenCalled();
    });

    it("should say it was not saved, and never why, when logging fails", async () => {
      mockLogRecipe.mockRejectedValue(new Error("network down while logging 275 g"));
      const user = await renderLogSearch();
      await type("chicken");

      await user.press(screen.getByRole("button", { name: addName }));

      expect(screen.getByText(notSaved)).toBeOnTheScreen();
      expect(screen.queryByText("Added Chicken and rice")).not.toBeOnTheScreen();
      expect(screen.queryByText(/network down/)).not.toBeOnTheScreen();
    });

    it("should say it could not undo, in its own words, when Undo fails", async () => {
      mockDeleteEntry.mockRejectedValue(new Error("network down"));
      const user = await renderLogSearch();
      await type("chicken");
      await user.press(screen.getByRole("button", { name: addName }));

      await user.press(screen.getByRole("button", { name: "Undo" }));

      expect(screen.getByText("Couldn't undo. Try again.")).toBeOnTheScreen();
      expect(screen.queryByText(notSaved)).not.toBeOnTheScreen();
    });

    it("should log in UTC when the profile has no time zone", async () => {
      profileTimeZone.current = { data: null, isPending: false, isError: false };
      const user = await renderLogSearch();
      await type("chicken");

      await user.press(screen.getByRole("button", { name: addName }));

      expect(mockLogRecipe.mock.calls[0]?.[0]).toMatchObject({
        loggedAt: "2026-10-14T18:00:00.000Z",
      });
    });
  });

  describe("when the recipe search fails", () => {
    const failed = { kind: "failed", debugMessage: "rpc failed" } as const;

    it("should leave the foods and their plus as they are, and leave the recipes out, with no alert", async () => {
      Object.assign(recipeSearchResult, { recipes: [chickenAndRice], error: failed });
      showFoods([chickenFillets]);
      const user = await renderLogSearch();
      await type("chicken");

      expect(screen.getByRole("heading", { name: "Your foods · Yours" })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: /^Chicken breast fillets, 100 g/ }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: /^Your recipes/ })).not.toBeOnTheScreen();
      expect(screen.queryByText("Chicken and rice")).not.toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(screen.queryByText(/rpc failed/)).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Add Chicken breast fillets, 100 g" }));
      expect(mockLogFood).toHaveBeenCalledTimes(1);
    });

    it("should show no recipes group when the foods search is the one that fails, and say so", async () => {
      Object.assign(searchResult, { localError: failed });
      await renderLogSearch();
      await type("chicken");

      expect(
        screen.getByRole("alert", {
          name: "Your foods could not be searched Check your connection and try again.",
        }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: /^Your recipes/ })).not.toBeOnTheScreen();
    });
  });

  describe("offline", () => {
    it("should disable the plus, and log nothing when it is pressed", async () => {
      onlineManager.setOnline(false);
      const user = await renderLogSearch();
      await type("chicken");

      expect(screen.getByRole("button", { name: addName })).toBeDisabled();
      await user.press(screen.getByRole("button", { name: addName }));

      expect(mockLogRecipe).not.toHaveBeenCalled();
    });

    it("should enable it again when the connection comes back", async () => {
      onlineManager.setOnline(false);
      await renderLogSearch();
      await type("chicken");

      await act(() => {
        onlineManager.setOnline(true);
      });

      expect(screen.getByRole("button", { name: addName })).toBeEnabled();
    });
  });

  describe("while the profile's time zone is not known", () => {
    it("should keep the plus off, because the time cannot be read yet", async () => {
      profileTimeZone.current = { data: undefined, isPending: true, isError: false };
      await renderLogSearch();
      await type("chicken");

      expect(mockUseProfileTimeZone).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: addName })).toBeDisabled();
    });
  });
});
