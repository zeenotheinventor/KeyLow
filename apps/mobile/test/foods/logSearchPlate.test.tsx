import { SNAPSHOT_VERSION } from "@keylow/core/diary";
import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo, Pressable, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import {
  mockGetFood,
  mockLogFood,
  mockLogRecipe,
  profileTimeZone,
  recentFoods,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import { compileFoodSearchStyles } from "./support/foodSearchStyles";
import {
  dayTargets,
  eatenDay,
  mockLogEntries,
  mockUseDiaryDay,
  mockUseTargets,
  recipeSearchResult,
  resetSearchApiClientMock,
  searchResult,
} from "./support/searchApiClientMock";
import FoodSearchRoute from "../../app/foods/index";
import { ToastProvider } from "../../components/ui";
import { PlateProvider, usePlate } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { oatBarInGrams } from "../plate/support/plateItems";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { FoodSearchHit, RecentFood, RecipeSummary } from "@keylow/api-client";

// The plate in the log search: a plus puts the serving on the plate and writes nothing, the bars show the
// day with the plate, and Log food(s) in the dock is the one thing that writes. The rows and their stats keep
// their own tests in logSearch.test.tsx and logSearchRecipes.test.tsx.

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

const bananaId = "77777777-7777-4777-8777-777777777777";
const mediumPortionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const recipeId = "00000000-0000-4000-8000-0000000000b1";

const banana: FoodSearchHit = {
  id: bananaId,
  source: "cofid",
  name: "Banana",
  brand: null,
  basis: "per_100g",
  kcal: 95,
  protein_g: 1.2,
  fat_g: 0.1,
  carbs_g: 20.3,
  fibre_g: null,
  quality: {},
  default_portion_id: mediumPortionId,
  default_portion_label: "1 medium",
  default_portion_grams: 150,
  default_portion_ml: null,
  score: 0.9,
};

// Chicken and rice as the board draws it: four servings of 275 g, 374 kcal each.
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

const oatsRecent: RecentFood = {
  foodId: savedFoodId,
  entryId: "entry-oats",
  loggedAt: "2026-10-14T07:05:00Z",
  portionId: null,
  snapshot: {
    v: SNAPSHOT_VERSION,
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

const addBanana = "Add Banana, 1 medium (150 g), to your plate";
const addRecipe = "Add Chicken and rice, 1 serving (275 g), to your plate";
const addOats = "Add Porridge oats, 50 g, to your plate";
const logOneFood = "Log food, 1 food on your plate";
const notLogged = "Not logged. Check your connection and try again.";

// What a screen of the sheet's stack, such as the picker, does to the plate without going through the search.
function PutOatBarOnThePlate() {
  const plate = usePlate();

  return (
    <Pressable
      role="button"
      aria-label="Add from the picker"
      onPress={() => {
        plate.add((key) => oatBarInGrams(key));
      }}
    >
      <Text>Add from the picker</Text>
    </Pressable>
  );
}

async function renderLogSearch(params: { day?: string; time?: string } = {}) {
  routerMock.searchParams = { day: "2026-10-15", ...params };
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <PlateProvider>
          <FoodSearchRoute />
          <PutOatBarOnThePlate />
        </PlateProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
  return user;
}

async function type(text: string) {
  await fireEvent.changeText(screen.getByRole("searchbox", { name: "Search foods" }), text);
}

const stripName = (text: RegExp) => screen.getByRole("group", { name: text });

describe("the plate in the log search", () => {
  let styles: string;
  let announce: jest.SpyInstance;

  beforeAll(async () => {
    styles = await compileFoodSearchStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-10-15T11:40:30Z") });
    registerAppStyles(styles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockReturnValue();
    resetRouterMock();
    resetApiClientMock();
    resetSearchApiClientMock();
    onlineManager.setOnline(true);
    searchResult.local = [banana];
    recipeSearchResult.recipes = [chickenAndRice];
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("an empty plate", () => {
    it("should have no Log food button, so the field keeps its full width", async () => {
      await renderLogSearch();

      expect(screen.queryByRole("button", { name: /^Log foods?\b/ })).not.toBeOnTheScreen();
    });

    it("should show the strip with what was eaten alone", async () => {
      await renderLogSearch();

      expect(
        stripName(/^Today\. Calories: 1,039 of 2,200 kilocalories\. Protein: 86 of 160 grams/),
      ).toBeOnTheScreen();
    });
  });

  describe("the plus on a result", () => {
    it("should put the serving on the plate and write nothing", async () => {
      const user = await renderLogSearch();
      await type("ba");

      await user.press(screen.getByRole("button", { name: addBanana }));

      expect(screen.getByRole("button", { name: logOneFood })).toBeOnTheScreen();
      expect(mockLogFood).not.toHaveBeenCalled();
      expect(mockLogRecipe).not.toHaveBeenCalled();
      expect(mockLogEntries).not.toHaveBeenCalled();
      expect(mockGetFood).not.toHaveBeenCalled();
    });

    it("should clear the field and show Quick add and Recent again", async () => {
      const user = await renderLogSearch();
      await type("ba");

      await user.press(screen.getByRole("button", { name: addBanana }));

      expect(screen.getByRole("searchbox", { name: "Search foods" })).toHaveDisplayValue("");
      expect(screen.getByRole("button", { name: /^Quick add/ })).toBeOnTheScreen();
    });

    it("should tell a screen reader, and show no toast", async () => {
      const user = await renderLogSearch();
      await type("ba");

      await user.press(screen.getByRole("button", { name: addBanana }));

      expect(announce).toHaveBeenCalledWith("Banana added to your plate");
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeOnTheScreen();
      expect(screen.queryByText(/^Added /)).not.toBeOnTheScreen();
    });

    it("should make one row of two when the same food is added twice", async () => {
      const user = await renderLogSearch();
      await type("ba");
      await user.press(screen.getByRole("button", { name: addBanana }));
      await type("ba");

      await user.press(screen.getByRole("button", { name: addBanana }));

      // One row on the plate, and the strip counts both servings: 1,039 plus 2 x 142.5 kcal.
      expect(screen.getByRole("button", { name: logOneFood })).toBeOnTheScreen();
      expect(
        stripName(
          /^Today with your plate\. Calories: 1,324 of 2,200 kilocalories, 285 on your plate/,
        ),
      ).toBeOnTheScreen();
    });
  });

  describe("the plus on a Recent food", () => {
    it("should put the amount last logged on the plate and write nothing", async () => {
      recentFoods.current = { data: [oatsRecent], isPending: false, isError: false };
      const user = await renderLogSearch();

      await user.press(screen.getByRole("button", { name: addOats }));

      expect(screen.getByRole("button", { name: logOneFood })).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith("Porridge oats added to your plate");
      expect(mockLogFood).not.toHaveBeenCalled();
      expect(mockGetFood).not.toHaveBeenCalled();
    });
  });

  describe("the plus on a recipe", () => {
    it("should put one serving on the plate and write nothing", async () => {
      const user = await renderLogSearch();
      await type("chicken");

      await user.press(screen.getByRole("button", { name: addRecipe }));

      expect(screen.getByRole("button", { name: logOneFood })).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith("Chicken and rice added to your plate");
      expect(mockLogRecipe).not.toHaveBeenCalled();
      expect(mockLogEntries).not.toHaveBeenCalled();
    });

    it("should grow the bars to eaten plus the plate, as the board reads", async () => {
      const user = await renderLogSearch();
      await type("chicken");

      await user.press(screen.getByRole("button", { name: addRecipe }));

      expect(
        stripName(
          /^Today with your plate\. Calories: 1,413 of 2,200 kilocalories, 374 on your plate\. /,
        ),
      ).toBeOnTheScreen();
    });
  });

  describe("Log foods", () => {
    async function plateWithTwoFoods() {
      const user = await renderLogSearch();
      await type("chicken");
      await user.press(screen.getByRole("button", { name: addRecipe }));
      await type("ba");
      await user.press(screen.getByRole("button", { name: addBanana }));

      return user;
    }

    it("should be named for the count once there are two foods", async () => {
      await plateWithTwoFoods();

      expect(
        screen.getByRole("button", { name: "Log foods, 2 foods on your plate" }),
      ).toBeOnTheScreen();
    });

    it("should write the plate once when pressed", async () => {
      const user = await renderLogSearch();
      await type("chicken");
      await user.press(screen.getByRole("button", { name: addRecipe }));

      await user.press(screen.getByRole("button", { name: logOneFood }));

      expect(mockLogEntries).toHaveBeenCalledTimes(1);
      expect(mockLogEntries.mock.calls[0]?.[0]).toHaveLength(1);
      expect(mockLogEntries.mock.calls[0]?.[0][0]).toMatchObject({ kind: "recipe" });
    });

    it("should dim every plus while it logs, and show no toast for a log that is going well", async () => {
      mockLogEntries.mockReturnValue(new Promise(() => undefined));
      searchResult.local = [banana];
      const user = await renderLogSearch();
      await type("chicken");
      await user.press(screen.getByRole("button", { name: addRecipe }));
      await type("ba");

      await user.press(screen.getByRole("button", { name: logOneFood }));

      expect(screen.getByRole("button", { name: addBanana })).toBeDisabled();
      expect(screen.queryByText(notLogged)).not.toBeOnTheScreen();
    });

    it("should say it was not logged, keep the plate and bring the button back when the write fails", async () => {
      mockLogEntries.mockRejectedValue(new Error("network down while logging Chicken and rice"));
      const user = await renderLogSearch();
      await type("chicken");
      await user.press(screen.getByRole("button", { name: addRecipe }));

      await user.press(screen.getByRole("button", { name: logOneFood }));

      expect(await screen.findByText(notLogged)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: logOneFood })).toBeEnabled();
      expect(
        stripName(/^Today with your plate\. Calories: 1,413 of 2,200 kilocalories/),
      ).toBeOnTheScreen();
    });
  });

  describe("while the plate is being logged", () => {
    async function plateWithARecipeBeingLogged() {
      mockLogEntries.mockReturnValue(new Promise(() => undefined));
      recentFoods.current = { data: [oatsRecent], isPending: false, isError: false };
      const user = await renderLogSearch();
      await type("chicken");
      await user.press(screen.getByRole("button", { name: addRecipe }));
      await user.press(screen.getByRole("button", { name: logOneFood }));
    }

    it("should show Log food as busy and disabled", async () => {
      await plateWithARecipeBeingLogged();

      expect(screen.getByRole("button", { name: logOneFood })).toBeBusy();
      expect(screen.getByRole("button", { name: logOneFood })).toBeDisabled();
    });

    it("should disable the plus of a Recent row", async () => {
      await plateWithARecipeBeingLogged();

      expect(screen.getByRole("button", { name: addOats })).toBeDisabled();
    });

    it("should say nothing is wrong when the button is pressed twice before the log has started", async () => {
      mockLogEntries.mockReturnValue(new Promise(() => undefined));
      const user = await renderLogSearch();
      await type("chicken");
      await user.press(screen.getByRole("button", { name: addRecipe }));

      // Both presses arrive before the screen has drawn the button as busy, as a quick double tap does.
      await act(async () => {
        const button = screen.getByRole("button", { name: logOneFood });
        // Both are started before either has finished, so neither waits for the screen to draw.
        await Promise.all([fireEvent.press(button), fireEvent.press(button)]);
      });

      expect(mockLogEntries).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(notLogged)).not.toBeOnTheScreen();
    });
  });

  describe("offline", () => {
    it("should say the plate can be filled and logging needs a connection", async () => {
      onlineManager.setOnline(false);
      await renderLogSearch();

      expect(screen.getByText("You're offline")).toBeOnTheScreen();
      expect(
        screen.getByText("You can fill your plate. Logging it needs a connection."),
      ).toBeOnTheScreen();
    });

    it("should keep the plus working and dim Log food", async () => {
      recentFoods.current = { data: [oatsRecent], isPending: false, isError: false };
      onlineManager.setOnline(false);
      const user = await renderLogSearch();

      await user.press(screen.getByRole("button", { name: addOats }));

      expect(screen.getByRole("button", { name: logOneFood })).toBeDisabled();
    });

    it("should not show the banner while online", async () => {
      await renderLogSearch();

      expect(screen.queryByText("You're offline")).not.toBeOnTheScreen();
    });
  });

  describe("a food added from elsewhere in the sheet", () => {
    it("should clear what was typed, as the picker's Add to plate does", async () => {
      const user = await renderLogSearch();
      await type("ba");

      await user.press(screen.getByRole("button", { name: "Add from the picker" }));

      expect(screen.getByRole("searchbox", { name: "Search foods" })).toHaveDisplayValue("");
      expect(screen.getByRole("button", { name: logOneFood })).toBeOnTheScreen();
    });

    it("should leave the field alone when nothing was added", async () => {
      await renderLogSearch();

      await type("ba");

      expect(screen.getByRole("searchbox", { name: "Search foods" })).toHaveDisplayValue("ba");
    });
  });

  describe("the bars", () => {
    it("should name a past day by its title", async () => {
      const user = await renderLogSearch({ day: "2026-10-14" });
      await type("chicken");
      await user.press(screen.getByRole("button", { name: addRecipe }));

      expect(stripName(/^Yesterday with your plate\. /)).toBeOnTheScreen();
    });

    it("should read the day and the targets of the day the sheet was opened for", async () => {
      await renderLogSearch({ day: "2026-10-14" });

      expect(mockUseDiaryDay).toHaveBeenCalledWith("2026-10-14", expect.anything());
      expect(mockUseTargets).toHaveBeenCalledWith(
        expect.objectContaining({ localDate: "2026-10-14" }),
      );
    });

    it("should read the day in UTC when the profile has no time zone", async () => {
      // 00:30 on the 15th in London, still the 14th in UTC.
      jest.setSystemTime(new Date("2026-10-14T23:30:00Z"));
      profileTimeZone.current = { data: null, isPending: false, isError: false };
      await renderLogSearch({ day: "2026-10-14" });

      expect(stripName(/^Today\. Calories: 1,039 of 2,200 kilocalories/)).toBeOnTheScreen();
    });

    it("should draw no strip, and still search, until the day is known", async () => {
      eatenDay.current = { data: undefined, isError: false };
      await renderLogSearch();
      await type("ba");

      expect(screen.queryByRole("group", { name: /kilocalories/ })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: addBanana })).toBeOnTheScreen();
    });

    it("should draw no strip when the targets cannot be read", async () => {
      dayTargets.current = { data: undefined, isError: true };
      await renderLogSearch();

      expect(screen.queryByRole("group", { name: /kilocalories/ })).not.toBeOnTheScreen();
    });

    it("should draw no strip when the day cannot be read", async () => {
      eatenDay.current = { data: undefined, isError: true };
      await renderLogSearch();

      expect(screen.queryByRole("group", { name: /kilocalories/ })).not.toBeOnTheScreen();
    });
  });

  describe("while the profile's time zone is not known", () => {
    it("should still put food on the plate, because nothing is written", async () => {
      profileTimeZone.current = { data: undefined, isPending: true, isError: false };
      const user = await renderLogSearch();
      await type("ba");

      await user.press(screen.getByRole("button", { name: addBanana }));

      expect(screen.getByRole("button", { name: logOneFood })).toBeDisabled();
    });
  });
});
