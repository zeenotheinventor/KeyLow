import { SNAPSHOT_VERSION } from "@keylow/core/diary";
import { buildFoodPortion } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import {
  foodFixture,
  mockDeleteEntry,
  mockGetFood,
  mockListFoodPortions,
  mockLogFood,
  profileTimeZone,
  recentFoods,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import { compileFoodSearchStyles } from "./support/foodSearchStyles";
import { resetSearchApiClientMock, searchResult } from "./support/searchApiClientMock";
import FoodSearchRoute from "../../app/foods/index";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { registerAppStyles } from "../support/nativeWindStyles";

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
  return { id, local_date: "2026-10-14" } as LogEntry;
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
        <FoodSearchRoute />
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

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    onlineManager.setOnline(true);
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
          <FoodSearchRoute />
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
    it("should offer Quick add, which only navigates, with the day and time carried on", async () => {
      const user = await renderLogSearch();

      await user.press(
        screen.getByRole("button", { name: "Quick add, Calories and macros by hand" }),
      );

      expect(routerMock.push).toHaveBeenCalledWith("/foods/quick-add?day=2026-10-14&time=12%3A00");
    });

    it("should say there is nothing recent when no food was ever logged", async () => {
      await renderLogSearch();

      expect(screen.getByText("Nothing recent")).toBeOnTheScreen();
      expect(screen.getByText("Foods you log appear here.")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: /Quick add/ })).toBeOnTheScreen();
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
        expect(screen.getByRole("button", { name: "Add Porridge oats, 50 g" })).toBeOnTheScreen();
      });

      it("should open the portion picker on a row, asking for the amount last logged", async () => {
        const user = await renderLogSearch();

        await user.press(screen.getByRole("button", { name: /^Porridge oats, 50 g/ }));

        expect(routerMock.push).toHaveBeenCalledWith(
          `/foods/${savedFoodId}/log?day=2026-10-14&time=12%3A00&recent=1`,
        );
      });

      it("should log the amount last logged at the sheet's hour when its plus is pressed", async () => {
        const user = await renderLogSearch();

        await user.press(screen.getByRole("button", { name: "Add Porridge oats, 50 g" }));

        expect(mockGetFood.mock.calls.map(([, id]) => id)).toEqual([savedFoodId]);
        expect(mockListFoodPortions.mock.calls.map(([, id]) => id)).toEqual([savedFoodId]);
        expect(mockLogFood).toHaveBeenCalledTimes(1);
        expect(mockLogFood).toHaveBeenCalledWith(
          expect.objectContaining({
            quantity: 50,
            unit: "g",
            loggedAt: "2026-10-14T11:00:00.000Z",
            localDate: "2026-10-14",
          }),
        );
      });
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
        screen.getByRole("button", { name: "Add Banana, 1 medium (150 g)" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Add Chicken breast, grilled, 100 g" }),
      ).toBeOnTheScreen();
    });
  });

  describe("the plus on a result", () => {
    beforeEach(() => {
      showResults([banana, chicken]);
      mockListFoodPortions.mockImplementation((_client, id) =>
        Promise.resolve(
          id === bananaId
            ? [
                {
                  ...buildFoodPortion(),
                  id: mediumPortionId,
                  food_id: bananaId,
                  label: "1 medium",
                  grams: 150,
                  is_default: true,
                },
              ]
            : [],
        ),
      );
    });

    it("should log the default serving at the sheet's hour, loading the whole food first", async () => {
      const user = await renderLogSearch();
      await type("ba");

      await user.press(screen.getByRole("button", { name: "Add Banana, 1 medium (150 g)" }));

      expect(mockGetFood.mock.calls.map(([, id]) => id)).toEqual([bananaId]);
      expect(mockLogFood).toHaveBeenCalledTimes(1);
      expect(mockLogFood.mock.calls[0]?.[0]).toMatchObject({
        food: { id: bananaId },
        quantity: 1,
        unit: "portion",
        portion: { id: mediumPortionId },
        loggedAt: "2026-10-14T11:00:00.000Z",
        localDate: "2026-10-14",
      });
    });

    it("should log 100 g when the food has no default portion", async () => {
      const user = await renderLogSearch();
      await type("ch");

      await user.press(screen.getByRole("button", { name: "Add Chicken breast, grilled, 100 g" }));

      expect(mockLogFood).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 100, unit: "g" }),
      );
      expect(mockLogFood.mock.calls[0]?.[0]).not.toHaveProperty("portion");
    });

    it("should log now when the sheet was opened from the dock, with a day and no hour", async () => {
      const user = await renderLogSearch({ day: "2026-10-15" });
      await type("ba");

      await user.press(screen.getByRole("button", { name: "Add Banana, 1 medium (150 g)" }));

      const input = mockLogFood.mock.calls[0]?.[0];
      // The clock has moved on a little while the tap was pressed.
      expect(input?.loggedAt).toMatch(/^2026-10-15T11:40:30\./);
      expect(input?.localDate).toBe("2026-10-15");
    });

    it("should leave the sheet open and say Added with the food's name", async () => {
      const user = await renderLogSearch();
      await type("ba");

      await user.press(screen.getByRole("button", { name: "Add Banana, 1 medium (150 g)" }));

      expect(screen.getByText("Added Banana")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
      expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeOnTheScreen();
    });

    it("should let several foods be added in a row", async () => {
      showResults([banana, chicken]);
      const user = await renderLogSearch();
      await type("ba");

      await user.press(screen.getByRole("button", { name: "Add Banana, 1 medium (150 g)" }));
      await user.press(screen.getByRole("button", { name: "Add Chicken breast, grilled, 100 g" }));

      expect(mockLogFood).toHaveBeenCalledTimes(2);
    });

    it("should remove only its own entry on Undo", async () => {
      mockLogFood
        .mockResolvedValueOnce(storedEntry("entry-banana"))
        .mockResolvedValueOnce(storedEntry("entry-chicken"));
      const user = await renderLogSearch();
      await type("ba");
      await user.press(screen.getByRole("button", { name: "Add Banana, 1 medium (150 g)" }));
      await user.press(screen.getByRole("button", { name: "Add Chicken breast, grilled, 100 g" }));

      await user.press(screen.getByRole("button", { name: "Undo" }));

      expect(mockDeleteEntry).toHaveBeenCalledTimes(1);
      expect(mockDeleteEntry).toHaveBeenCalledWith(storedEntry("entry-chicken"));
    });

    it("should log once however often the plus is pressed before the first has finished", async () => {
      let finish: (entry: LogEntry) => void = () => undefined;
      mockLogFood.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const user = await renderLogSearch();
      await type("ba");

      await user.press(screen.getByRole("button", { name: "Add Banana, 1 medium (150 g)" }));
      await user.press(screen.getByRole("button", { name: "Add Banana, 1 medium (150 g)" }));
      await act(() => {
        finish(storedEntry("entry-banana"));
      });

      expect(mockLogFood).toHaveBeenCalledTimes(1);
    });

    it("should say it was not saved, and not Added, when logging fails", async () => {
      mockLogFood.mockRejectedValue(new Error("network down while logging 150 g"));
      const user = await renderLogSearch();
      await type("ba");

      await user.press(screen.getByRole("button", { name: "Add Banana, 1 medium (150 g)" }));

      expect(screen.getByText("Not saved. Check your connection and try again.")).toBeOnTheScreen();
      expect(screen.queryByText("Added Banana")).not.toBeOnTheScreen();
      expect(screen.queryByText(/150 g\b.*network/)).not.toBeOnTheScreen();
    });

    it("should say it was not saved when the food cannot be loaded", async () => {
      mockGetFood.mockRejectedValue(new Error("offline"));
      const user = await renderLogSearch();
      await type("ba");

      await user.press(screen.getByRole("button", { name: "Add Banana, 1 medium (150 g)" }));

      expect(mockLogFood).not.toHaveBeenCalled();
      expect(screen.getByText("Not saved. Check your connection and try again.")).toBeOnTheScreen();
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

  describe("offline", () => {
    it("should disable every plus on the results and on Recent, and leave the rows pressable", async () => {
      recentFoods.current = { data: [oatsRecent], isPending: false, isError: false };
      showResults([banana]);
      onlineManager.setOnline(false);
      const user = await renderLogSearch();
      await type("ba");

      expect(screen.getByRole("button", { name: "Add Banana, 1 medium (150 g)" })).toBeDisabled();
      await user.press(screen.getByRole("button", { name: "Add Banana, 1 medium (150 g)" }));
      expect(mockLogFood).not.toHaveBeenCalled();
      await type("");
      expect(screen.getByRole("button", { name: "Add Porridge oats, 50 g" })).toBeDisabled();
      expect(screen.getByRole("button", { name: /^Porridge oats, 50 g/ })).toBeEnabled();
    });

    it("should enable the plus again when the connection comes back", async () => {
      showResults([banana]);
      onlineManager.setOnline(false);
      await renderLogSearch();
      await type("ba");

      await act(() => {
        onlineManager.setOnline(true);
      });

      expect(screen.getByRole("button", { name: "Add Banana, 1 medium (150 g)" })).toBeEnabled();
    });
  });

  describe("while the profile's time zone is not known", () => {
    it("should keep the plus off, because the time cannot be read yet", async () => {
      profileTimeZone.current = { data: undefined, isPending: true, isError: false };
      showResults([banana]);
      await renderLogSearch();
      await type("ba");

      expect(screen.getByRole("button", { name: "Add Banana, 1 medium (150 g)" })).toBeDisabled();
    });
  });
});
