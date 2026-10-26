import { SNAPSHOT_VERSION, buildLogEntry } from "@keylow/core/diary";
import { buildFood } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import {
  foodFixture,
  mockGetFood,
  mockLogFood,
  mockUseProfileTimeZone,
  mockUseRecentFoods,
  recentFoods,
  termsAccepted,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import { compileFoodSearchStyles } from "./support/foodSearchStyles";
import {
  offCandidateFixture,
  resetSearchApiClientMock,
  searchResult,
} from "./support/searchApiClientMock";
import FoodSearchRoute from "../../app/foods/index";
import { ToastProvider } from "../../components/ui";
import { PlateProvider } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";

import type { FoodSearchHit, LogEntry, RecentFood } from "@keylow/api-client";

// The food search sheet while food is being logged to a day: opened with `day` (and `time` from an hour's
// plus). The plain search keeps its own tests in search.test.tsx.

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

// The search sheet guards its plate with a hold on leaving, which needs a navigator. These tests are not about leaving.
jest.mock("expo-router/react-navigation", () => ({ usePreventRemove: () => undefined }));

setUpTests();

const bananaId = "77777777-7777-4777-8777-777777777777";
const chickenId = "88888888-8888-4888-8888-888888888888";
const barId = "99999999-9999-4999-8999-999999999999";
const mediumPortionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function hit(changes: Partial<FoodSearchHit>): FoodSearchHit {
  return {
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
    default_portion_id: null,
    default_portion_label: null,
    default_portion_grams: null,
    default_portion_ml: null,
    score: 0.9,
    ...changes,
  };
}

const banana = hit({
  default_portion_id: mediumPortionId,
  default_portion_label: "1 medium",
  default_portion_grams: 150,
});
const chicken = hit({
  id: chickenId,
  name: "Chicken breast, grilled",
  kcal: 148,
  protein_g: 32,
  fat_g: 2.2,
  carbs_g: 0,
  score: 0.5,
});
const proteinBar = hit({
  id: barId,
  source: "off",
  name: "Protein bar",
  carbs_g: null,
  score: 0.4,
});

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

// What the log stores for a tap, so Undo has an entry to remove.
function storedEntry(id: string): LogEntry {
  const entry = buildLogEntry({
    food: foodFixture,
    quantity: 100,
    unit: "g",
    loggedAt: "2026-10-14T11:00:00.000Z",
    localDate: "2026-10-14",
  });

  return { ...entry, id, created_at: "2026-10-14T11:00:01.000Z", kcal: 420 };
}

async function renderLogSearch(params: { day?: string; time?: string } = {}) {
  routerMock.searchParams = { day: "2026-10-14", time: "12:00", ...params };
  if (params.day === "2026-10-15") {
    // The dock and the centre plus send a day only.
    routerMock.searchParams = { day: params.day };
  }
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

async function type(text: string) {
  await fireEvent.changeText(screen.getByRole("searchbox", { name: "Search foods" }), text);
}

function showResults(local: FoodSearchHit[]) {
  Object.assign(searchResult, { local });
}

describe("food search sheet in log mode", () => {
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
    mockGetFood.mockImplementation((_client, id) =>
      Promise.resolve({ ...foodFixture, id, name: id === bananaId ? "Banana" : "Food" }),
    );
    mockLogFood.mockResolvedValue(storedEntry("entry-new"));
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("the header", () => {
    it("should be titled Log food, with Close and no create control", async () => {
      await renderLogSearch();

      expect(screen.getByRole("heading", { name: "Log food" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Create a food" })).not.toBeOnTheScreen();
    });

    it("should be the plain search, titled Find food, without a day", async () => {
      routerMock.searchParams = {};
      await render(
        <ThemeProvider fixedPreference="dark">
          <PlateProvider>
            <FoodSearchRoute />
          </PlateProvider>
        </ThemeProvider>,
      );

      expect(screen.getByRole("heading", { name: "Find food" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /Quick add/ })).not.toBeOnTheScreen();
    });

    it("should carry the day and the time on to the scanner", async () => {
      const user = await renderLogSearch();

      await user.press(screen.getByRole("button", { name: "Scan barcode" }));

      expect(routerMock.push).toHaveBeenCalledWith("/foods/scan?day=2026-10-14&time=12%3A00");
    });
  });

  describe("before anything is typed", () => {
    it("should say there is nothing recent when no food was ever logged", async () => {
      await renderLogSearch();

      expect(screen.getByText("Nothing recent")).toBeOnTheScreen();
      expect(screen.getByText("Foods you log appear here.")).toBeOnTheScreen();
    });

    describe("the Quick add row", () => {
      const quickAddRow = () =>
        screen.getByRole("button", { name: "Quick add, Calories and macros by hand" });

      it("should be offered when there is nothing recent", async () => {
        await renderLogSearch();

        expect(quickAddRow()).toBeOnTheScreen();
        expect(screen.getByText("Calories and macros by hand")).toBeOnTheScreen();
      });

      it("should sit above Recent when there are recent foods", async () => {
        recentFoods.current = { data: [oatsRecent], isPending: false, isError: false };
        await renderLogSearch();

        expectTextsInOrder(screen.getAllByText(/^(Quick add|Recent|Porridge oats)/), [
          "Quick add",
          "Recent · as last logged",
          "Porridge oats",
        ]);
      });

      it("should open the quick add form with the day and the hour the plus was pressed on", async () => {
        const user = await renderLogSearch({ day: "2026-10-14", time: "12:00" });

        await user.press(quickAddRow());

        expect(routerMock.push).toHaveBeenCalledWith(
          "/foods/quick-add?day=2026-10-14&time=12%3A00",
        );
      });

      it("should open it with the day alone from the dock, which means now", async () => {
        const user = await renderLogSearch({ day: "2026-10-15" });

        await user.press(quickAddRow());

        expect(routerMock.push).toHaveBeenCalledWith("/foods/quick-add?day=2026-10-15");
      });

      it("should go once something is typed, because the results are what the person asked for", async () => {
        await renderLogSearch();

        await type("banana");

        expect(screen.queryByRole("button", { name: /^Quick add/ })).not.toBeOnTheScreen();
      });

      it("should stay pressable offline, because the form itself waits for a connection", async () => {
        const user = await renderLogSearch();
        await act(() => {
          onlineManager.setOnline(false);
        });

        await user.press(quickAddRow());

        expect(routerMock.push).toHaveBeenCalledTimes(1);
      });
    });

    it("should say Recent could not be loaded, rather than leave the sheet blank", async () => {
      recentFoods.current = { data: undefined, isPending: false, isError: true };
      await renderLogSearch();

      expect(screen.getByText("Couldn't load recent foods")).toBeOnTheScreen();
      expect(screen.getByText("Check your connection and try again.")).toBeOnTheScreen();
    });

    describe("the terms gate", () => {
      it("should read neither Recent nor the time zone while the Terms are not accepted", async () => {
        termsAccepted.current = false;
        await renderLogSearch();

        expect(mockUseRecentFoods).toHaveBeenCalled();
        expect(mockUseRecentFoods.mock.calls.every(([options]) => options?.enabled === false)).toBe(
          true,
        );
        expect(mockUseProfileTimeZone).toHaveBeenCalled();
        expect(
          mockUseProfileTimeZone.mock.calls.every(([options]) => options?.enabled === false),
        ).toBe(true);
      });

      it("should read both once the Terms are accepted", async () => {
        await renderLogSearch();

        expect(mockUseRecentFoods.mock.calls.every(([options]) => options?.enabled === true)).toBe(
          true,
        );
        expect(
          mockUseProfileTimeZone.mock.calls.every(([options]) => options?.enabled === true),
        ).toBe(true);
      });
    });

    describe("with recent foods", () => {
      beforeEach(() => {
        recentFoods.current = { data: [oatsRecent], isPending: false, isError: false };
      });

      it("should head the list Recent, as last logged, with the amount last logged on each row", async () => {
        await renderLogSearch();

        expect(screen.getByRole("heading", { name: /^Recent/ })).toBeOnTheScreen();
        expect(screen.getByText(/as last logged/)).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: /^Porridge oats, 50 g/ })).toBeOnTheScreen();
        expect(
          screen.getByRole("button", { name: "Add Porridge oats, 50 g, to your plate" }),
        ).toBeOnTheScreen();
      });

      it("should open the portion picker on a row, asking for the amount last logged", async () => {
        const user = await renderLogSearch();

        await user.press(screen.getByRole("button", { name: /^Porridge oats, 50 g/ }));

        expect(routerMock.push).toHaveBeenCalledWith(
          `/foods/${savedFoodId}/log?day=2026-10-14&time=12%3A00&recent=1`,
        );
      });
    });
  });

  describe("with a food last logged in spoons", () => {
    // 2 tbsp of olive oil, a density of 0.92 g/ml from its CoFID group.
    const oil = buildFood({
      id: savedFoodId,
      name: "Oil, olive",
      source: "cofid",
      food_group: "OC",
    });
    const tablespoon = { id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: 15 };
    const oilRecent: RecentFood = {
      foodId: savedFoodId,
      entryId: "entry-oil",
      loggedAt: "2026-10-14T07:05:00Z",
      portionId: null,
      snapshot: buildLogEntry({
        food: oil,
        quantity: 2,
        unit: "portion",
        portion: tablespoon,
        loggedAt: "2026-10-14T07:05:00.000Z",
        localDate: "2026-10-14",
      }).snapshot,
    };

    beforeEach(() => {
      recentFoods.current = { data: [oilRecent], isPending: false, isError: false };
    });

    it("should write the amount last logged as the count and the millilitres", async () => {
      await renderLogSearch();

      expect(
        screen.getByRole("button", { name: /^Oil, olive, 2 tbsp \(30 ml\)/ }),
      ).toBeOnTheScreen();
    });
  });

  describe("the results", () => {
    beforeEach(() => {
      showResults([banana, chicken]);
    });

    it("should show a serving on each row, the default portion or 100 g", async () => {
      await renderLogSearch();
      await type("ba");

      expect(screen.getByRole("button", { name: /^Banana, 1 medium \(150 g\)/ })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: /^Chicken breast, grilled, 100 g/ }),
      ).toBeOnTheScreen();
    });

    it("should show the values for the serving, not per 100 g", async () => {
      await renderLogSearch();
      await type("ba");

      // 150 g of a food with 95 kcal for 100 g.
      expect(
        screen.getByRole("button", {
          name: /^Banana, 1 medium \(150 g\), 143 kilocalories, protein 1\.8 grams/,
        }),
      ).toBeOnTheScreen();
      expect(screen.queryByText("Values per 100 g unless marked")).not.toBeOnTheScreen();
    });

    it("should keep the rows in the order the search returned them, and not sort them again", async () => {
      showResults([
        hit({ id: chickenId, name: "Zebra cake", score: 0.2 }),
        hit({ id: bananaId, name: "Apple", score: 0.9 }),
      ]);
      await renderLogSearch();
      await type("ap");

      const rows = screen.getAllByRole("button", { name: /^(Zebra cake|Apple), 100 g/ });
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveAccessibleName(/^Zebra cake/);
      expect(rows[1]).toHaveAccessibleName(/^Apple/);
    });

    it("should open the portion picker, and not the food, on a row", async () => {
      const user = await renderLogSearch();
      await type("ba");

      await user.press(screen.getByRole("button", { name: /^Banana, 1 medium/ }));

      expect(routerMock.push).toHaveBeenCalledWith(
        `/foods/${bananaId}/log?day=2026-10-14&time=12%3A00`,
      );
    });

    it("should name each plus by the food and its serving", async () => {
      await renderLogSearch();
      await type("ba");

      expect(
        screen.getByRole("button", { name: "Add Banana, 1 medium (150 g), to your plate" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Add Chicken breast, grilled, 100 g, to your plate" }),
      ).toBeOnTheScreen();
    });
  });

  describe("a drink with no portion", () => {
    const milk = hit({ id: chickenId, name: "Milk", basis: "per_100ml", kcal: 46 });

    it("should be named for 100 ml", async () => {
      showResults([milk]);
      await renderLogSearch();
      await type("mi");

      expect(screen.getByRole("button", { name: /^Milk, 100 ml/ })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Add Milk, 100 ml, to your plate" }),
      ).toBeOnTheScreen();
    });
  });

  describe("Open Food Facts results", () => {
    it("should keep the per 100 g note above them, because their rows stay per 100 g", async () => {
      Object.assign(searchResult, { local: [banana], off: [offCandidateFixture] });
      await renderLogSearch();
      await type("oat");

      expect(screen.getByText("Values per 100 g unless marked")).toBeOnTheScreen();
    });

    it("should leave the note out when there are only servings", async () => {
      showResults([banana]);
      await renderLogSearch();
      await type("ba");

      expect(screen.queryByText("Values per 100 g unless marked")).not.toBeOnTheScreen();
    });
  });

  describe("a food that needs review", () => {
    beforeEach(() => {
      showResults([proteinBar]);
    });

    it("should say Needs review and have no plus", async () => {
      await renderLogSearch();
      await type("pr");

      expect(screen.getByText("Needs review")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Add Protein bar/ })).not.toBeOnTheScreen();
    });

    it("should open the portion picker, where it must be reviewed, on a tap", async () => {
      const user = await renderLogSearch();
      await type("pr");

      await user.press(screen.getByRole("button", { name: /^Protein bar/ }));

      expect(routerMock.push).toHaveBeenCalledWith(
        `/foods/${barId}/log?day=2026-10-14&time=12%3A00`,
      );
    });

    it("should count a food flagged suspect as needing review though its values are all given", async () => {
      showResults([hit({ id: barId, name: "Protein bar", quality: { suspect: true } })]);
      await renderLogSearch();
      await type("pr");

      expect(screen.getByText("Needs review")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Add Protein bar/ })).not.toBeOnTheScreen();
    });
  });
});
