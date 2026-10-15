import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from "@testing-library/react-native";
import { ScrollView } from "react-native";

import { DiaryScreen } from "../components/DiaryScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  foodEntry,
  noTargets,
  requestsTo,
  resetDiaryBackend,
  sampleDay,
} from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
// 11:20 in London on Thursday 15 October 2026, so the current hour is 11:00.
jest.mock("../lib/useNow", () => {
  const mockNow = new Date("2026-10-15T10:20:00Z");

  return { useNow: () => mockNow };
});

let queryClient: QueryClient;

async function renderDiary() {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <DiaryScreen />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

async function renderLoadedDiary() {
  await renderDiary();
  await screen.findByRole("button", { name: "Add food at 08:00" });
}

// An hour is named by its hour and its foods. The current hour's chip is named "11:00, now", which is not one.
const hourItems = () => screen.getAllByLabelText(/^\d{2}:00, (nothing logged|\d+ foods?)$/);
const addButtons = () => screen.getAllByRole("button", { name: /^Add food at / });
const strip = () => screen.getByRole("button", { name: /^Targets\./ });

describe("the diary screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DiaryScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    diaryBackend.entries = sampleDay();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("today", () => {
    it("should be headed Today, with the calendar and more buttons drawn", async () => {
      await renderLoadedDiary();

      expect(screen.getByRole("heading", { name: "Today" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Choose a date" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "More" })).toBeOnTheScreen();
    });

    it("should draw the week Monday to Sunday, today selected and later days not pressable", async () => {
      await renderLoadedDiary();

      expect(screen.getByRole("button", { name: "Monday 12 October" })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Thursday 15 October, today", selected: true }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Friday 16 October" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Sunday 18 October" })).toBeDisabled();
    });

    it("should draw the four bars from the day's foods against the targets, as one button named Targets", async () => {
      await renderLoadedDiary();

      expect(strip()).toHaveAccessibleName(
        "Targets. Calories: 1,039 of 2,200 kilocalories. Protein: 86 of 160 grams. Carbohydrate: 129 of 220 grams. Fat: 19 of 70 grams",
      );
    });

    it("should list all 24 hours from 00:00 to 23:00 with a plus on each", async () => {
      await renderLoadedDiary();

      expect(addButtons()).toHaveLength(24);
      expect(screen.getByRole("button", { name: "Add food at 00:00" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add food at 23:00" })).toBeOnTheScreen();
    });

    it("should put the 24 hours straight into the list, with nothing between them", async () => {
      await renderLoadedDiary();
      const items = hourItems();

      const list = items[0]?.parent;
      expect(items).toHaveLength(24);
      expect(list).toHaveProp("role", "list");
      // Every child of the list is an hour: no gap view, no separator, nothing else.
      expect(list?.children).toHaveLength(24);
      for (const child of list?.children ?? []) {
        expect(typeof child).toBe("object");
        if (typeof child !== "string") {
          expect(child).toHaveProp("role", "listitem");
        }
      }
    });

    it("should show each food under its hour, with the time and amount as the caption", async () => {
      await renderLoadedDiary();
      const eight = screen.getByLabelText("08:00, 3 foods");

      expect(
        within(eight).getByRole("button", { name: /^Porridge oats, 08:05 · 50 g/ }),
      ).toBeOnTheScreen();
      expect(
        within(eight).getByRole("button", { name: /^Banana, 08:10 · 1 medium \(100 g\)/ }),
      ).toBeOnTheScreen();
      expect(
        within(screen.getByLabelText("12:00, 3 foods")).getByRole("button", {
          name: /^Meal deal crisps, 12:45 · Quick add/,
        }),
      ).toBeOnTheScreen();
    });

    it("should mark the current hour as now, and no other", async () => {
      await renderLoadedDiary();

      expect(screen.getByLabelText("11:00, now")).toBeOnTheScreen();
      expect(screen.getAllByLabelText(/, now$/)).toHaveLength(1);
    });

    it("should read the hours in the profile's zone, not in UTC", async () => {
      await renderLoadedDiary();

      // 07:05 UTC is 08:05 in London on British Summer Time.
      expect(screen.getByLabelText("08:00, 3 foods")).toBeOnTheScreen();
      expect(screen.queryByLabelText("07:00, 3 foods")).not.toBeOnTheScreen();
    });

    it("should end the log with the Mark day complete switch, off", async () => {
      await renderLoadedDiary();

      const toggle = screen.getByRole("switch");
      expect(toggle).toHaveAccessibleName(/Mark day complete/);
      expect(toggle).not.toBeChecked();
    });

    it("should show no banner and no Nothing logged yet card", async () => {
      await renderLoadedDiary();

      expect(screen.queryByText("No target set")).not.toBeOnTheScreen();
      expect(screen.queryByText("You're offline")).not.toBeOnTheScreen();
      expect(screen.queryByText("Nothing logged yet")).not.toBeOnTheScreen();
    });
  });

  describe("adding food", () => {
    it("should open food search for the hour's day with the time on the hour, from an hour's plus", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();

      await user.press(screen.getByRole("button", { name: "Add food at 12:00" }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith("/foods?day=2026-10-15&time=12:00");
    });

    it("should pad a single digit hour, as in 07:00", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();

      await user.press(screen.getByRole("button", { name: "Add food at 07:00" }));

      expect(routerMock.push).toHaveBeenCalledWith("/foods?day=2026-10-15&time=07:00");
    });

    it("should send the day on view, not today, from a past day's plus", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();
      await user.press(screen.getByRole("button", { name: "Wednesday 14 October" }));
      await screen.findByRole("heading", { name: "Wed 14 Oct" });

      await user.press(screen.getByRole("button", { name: "Add food at 09:00" }));

      expect(routerMock.push).toHaveBeenCalledWith("/foods?day=2026-10-14&time=09:00");
    });
  });

  describe("the progress bars and Targets", () => {
    it("should open Targets when the bars are pressed", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();

      await user.press(strip());

      expect(routerMock.push).toHaveBeenCalledWith("/targets");
    });

    it("should say Full bars are over target, in words, for a day past the target", async () => {
      diaryBackend.entries = [
        ...sampleDay(),
        foodEntry({
          date: "2026-10-15",
          utcTime: "18:30",
          name: "Lasagne",
          quantity: 400,
          unit: "g",
          kcal: 1373,
          protein: 64,
          fat: 62,
          carbs: 128,
        }),
      ];
      await renderLoadedDiary();

      expect(strip()).toHaveAccessibleName(
        /Calories: 2,412 of 2,200 kilocalories, over target\. Protein: 150 of 160 grams\. Carbohydrate: 257 of 220 grams, over target/,
      );
    });
  });

  describe("with no target", () => {
    beforeEach(() => {
      diaryBackend.targets = noTargets;
    });

    it("should show the info banner, and the bars with values only", async () => {
      await renderLoadedDiary();

      expect(screen.getByText("No target set")).toBeOnTheScreen();
      expect(strip()).toHaveAccessibleName(
        "Targets. Calories: 1,039 kilocalories. Protein: 86 grams. Carbohydrate: 129 grams. Fat: 19 grams",
      );
    });

    it("should open Targets from Set target", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();

      await user.press(screen.getByRole("button", { name: "Set target" }));

      expect(routerMock.push).toHaveBeenCalledWith("/targets");
    });
  });

  describe("an empty day", () => {
    beforeEach(() => {
      diaryBackend.entries = [];
    });

    it("should show the Nothing logged yet card above 00:00, with Copy yesterday", async () => {
      await renderLoadedDiary();

      expect(screen.getByLabelText("Nothing logged yet")).toBeOnTheScreen();
      expect(screen.getByText("Tap + on an hour, search, scan or quick add.")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Copy yesterday" })).toBeOnTheScreen();
    });

    it("should still show all 24 hours with their plus, none of them with foods", async () => {
      await renderLoadedDiary();

      expect(addButtons()).toHaveLength(24);
      expect(screen.getAllByLabelText(/, nothing logged$/)).toHaveLength(24);
    });

    it("should disable Copy yesterday and say so when yesterday is empty too", async () => {
      await renderLoadedDiary();

      expect(await screen.findByText("Nothing logged yesterday")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Copy yesterday" })).toBeDisabled();
    });

    it("should keep Copy yesterday enabled when yesterday has foods", async () => {
      diaryBackend.entries = sampleDay("2026-10-14");
      await renderLoadedDiary();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      expect(screen.queryByText("Nothing logged yesterday")).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Copy yesterday" })).toBeEnabled();
    });
  });

  describe("a complete day", () => {
    it("should show the switch on, named Day complete, and a tick on the day's pill", async () => {
      diaryBackend.dayLogs = [
        {
          local_date: "2026-10-15",
          is_complete: true,
          completed_at: "2026-10-15T20:00:00+00:00",
          note: null,
        },
      ];
      await renderLoadedDiary();

      expect(screen.getByRole("switch")).toBeChecked();
      expect(screen.getByRole("switch")).toHaveAccessibleName(/Day complete/);
      expect(
        screen.getByRole("button", { name: "Thursday 15 October, today, complete" }),
      ).toBeOnTheScreen();
    });
  });

  describe("a past day", () => {
    it("should show the date as the title and select that day on the strip", async () => {
      const user = userEvent.setup();
      diaryBackend.entries = [...sampleDay(), ...sampleDay("2026-10-14")];
      await renderLoadedDiary();

      await user.press(screen.getByRole("button", { name: "Wednesday 14 October" }));

      expect(await screen.findByRole("heading", { name: "Wed 14 Oct" })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Wednesday 14 October", selected: true }),
      ).toBeOnTheScreen();
    });

    it("should read that day's entries, and mark no hour as now", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();

      await user.press(screen.getByRole("button", { name: "Wednesday 14 October" }));
      await screen.findByRole("heading", { name: "Wed 14 Oct" });

      expect(
        diaryBackend.requests.some(
          (request) =>
            request.table === "food_log_entries" &&
            request.search.includes("local_date=eq.2026-10-14"),
        ),
      ).toBe(true);
      expect(screen.queryByLabelText(/, now$/)).not.toBeOnTheScreen();
    });

    it("should go back to Today when today is pressed again", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();
      await user.press(screen.getByRole("button", { name: "Wednesday 14 October" }));
      await screen.findByRole("heading", { name: "Wed 14 Oct" });

      await user.press(screen.getByRole("button", { name: "Thursday 15 October, today" }));

      expect(await screen.findByRole("heading", { name: "Today" })).toBeOnTheScreen();
    });
  });

  describe("loading", () => {
    it("should show the header and a skeleton, and no hours, while the day loads", async () => {
      diaryBackend.hungTables.add("food_log_entries");
      await renderDiary();

      expect(await screen.findByRole("heading", { name: "Today" })).toBeOnTheScreen();
      // The skeleton is hidden from screen readers by design, so it is found by its id.
      expect(
        await screen.findByTestId("skeleton-diary", { includeHiddenElements: true }),
      ).toBeDefined();
      expect(screen.queryByRole("button", { name: /^Add food at / })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Targets\./ })).not.toBeOnTheScreen();
    });
  });

  describe("the week strip while a day loads", () => {
    async function goToHungYesterday() {
      const user = userEvent.setup();
      await renderLoadedDiary();
      return user;
    }

    it("should stay on screen with the header when the day picked is slow to load", async () => {
      const user = await goToHungYesterday();
      diaryBackend.hungTables.add("food_log_entries");

      await user.press(screen.getByRole("button", { name: "Wednesday 14 October" }));

      expect(await screen.findByRole("heading", { name: "Wed 14 Oct" })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Wednesday 14 October", selected: true }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Monday 12 October" })).toBeEnabled();
      // Only the bars and the log below the strip are the skeleton.
      expect(screen.queryByRole("button", { name: /^Add food at / })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Targets\./ })).not.toBeOnTheScreen();
    });

    it("should let the person go back to today from there, to the day already read", async () => {
      const user = await goToHungYesterday();
      diaryBackend.hungTables.add("food_log_entries");
      await user.press(screen.getByRole("button", { name: "Wednesday 14 October" }));
      await screen.findByRole("heading", { name: "Wed 14 Oct" });

      await user.press(screen.getByRole("button", { name: "Thursday 15 October, today" }));

      expect(await screen.findByRole("heading", { name: "Today" })).toBeOnTheScreen();
      expect(await screen.findByRole("button", { name: "Add food at 08:00" })).toBeOnTheScreen();
    });

    it("should stay on screen offline, where the day picked waits for the connection", async () => {
      const user = await goToHungYesterday();
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(screen.getByRole("button", { name: "Wednesday 14 October" }));

      expect(await screen.findByRole("heading", { name: "Wed 14 Oct" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Monday 12 October" })).toBeEnabled();
      expect(screen.getByText("You're offline")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Add food at / })).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Thursday 15 October, today" }));

      expect(await screen.findByRole("heading", { name: "Today" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add food at 08:00" })).toBeDisabled();
    });

    it("should draw the whole skeleton, strip included, only until the first day has loaded", async () => {
      diaryBackend.hungTables.add("food_log_entries");
      await renderDiary();

      expect(
        await screen.findByTestId("skeleton-diary", { includeHiddenElements: true }),
      ).toBeDefined();
      expect(screen.queryByRole("button", { name: "Monday 12 October" })).not.toBeOnTheScreen();
    });
  });

  describe("a cold start offline", () => {
    it("should show the offline notice over a skeleton, and no strip or log, until a connection returns", async () => {
      await act(() => {
        onlineManager.setOnline(false);
      });
      await renderDiary();

      expect(await screen.findByText("You're offline")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Today" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Add food at / })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Monday 12 October" })).not.toBeOnTheScreen();
      expect(requestsTo("food_log_entries")).toBe(0);
    });
  });

  describe("a failed load", () => {
    it("should show the error state with Try again, and no log", async () => {
      diaryBackend.failingTables.add("food_log_entries");
      await renderDiary();

      expect(await screen.findByText("Couldn't load your diary")).toBeOnTheScreen();
      expect(screen.getByText("Check your connection and try again.")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Add food at / })).not.toBeOnTheScreen();
    });

    it("should keep the title and the strip, and show the log after Try again succeeds", async () => {
      const user = userEvent.setup();
      diaryBackend.failingTables.add("food_log_entries");
      await renderDiary();
      await screen.findByText("Couldn't load your diary");
      expect(screen.getByRole("heading", { name: "Today" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Monday 12 October" })).toBeOnTheScreen();

      diaryBackend.failingTables.clear();
      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByRole("button", { name: "Add food at 08:00" })).toBeOnTheScreen();
    });

    it("should not put the database's own words on the screen", async () => {
      diaryBackend.failingTables.add("food_log_entries");
      await renderDiary();

      await screen.findByText("Couldn't load your diary");

      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
    });
  });

  describe("offline", () => {
    async function goOffline() {
      await renderLoadedDiary();
      await act(() => {
        onlineManager.setOnline(false);
      });
    }

    it("should show the offline banner and keep the foods readable", async () => {
      await goOffline();

      expect(screen.getByText("You're offline")).toBeOnTheScreen();
      expect(
        screen.getByText("Showing your last saved diary. Changes need a connection."),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: /^Porridge oats/ })).toBeEnabled();
    });

    it("should dim every hour's plus to 40 percent and disable it", async () => {
      await goOffline();

      expect(addButtons()).toHaveLength(24);
      for (const add of addButtons()) {
        expect(add).toBeDisabled();
        expect(add).toHaveStyle({ opacity: Math.fround(0.4) });
      }
    });

    it("should open nothing when a disabled plus is pressed", async () => {
      const user = userEvent.setup();
      await goOffline();

      await user.press(screen.getByRole("button", { name: "Add food at 12:00" }));

      expect(routerMock.push).not.toHaveBeenCalled();
    });

    it("should disable the complete switch", async () => {
      await goOffline();

      expect(screen.getByRole("switch")).toBeDisabled();
    });

    it("should enable everything again when the connection returns", async () => {
      await goOffline();

      await act(() => {
        onlineManager.setOnline(true);
      });

      expect(screen.queryByText("You're offline")).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add food at 12:00" })).toBeEnabled();
      expect(screen.getByRole("switch")).toBeEnabled();
    });
  });

  describe("the terms gate", () => {
    it("should make no diary, targets or time zone request while the terms are not accepted", async () => {
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      await renderDiary();
      await screen.findByTestId("skeleton-diary", { includeHiddenElements: true });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // The gate's own read of the acceptance is the only request.
      expect(diaryBackend.requests.length).toBeGreaterThan(0);
      expect(
        diaryBackend.requests.filter((request) => !request.search.includes("terms_accepted_at")),
      ).toEqual([]);
      expect(requestsTo("food_log_entries")).toBe(0);
      expect(requestsTo("day_logs")).toBe(0);
    });

    it("should make no request while the acceptance is still loading, because that counts as not accepted", async () => {
      diaryBackend.hungTables.add("profiles");
      await renderDiary();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(requestsTo("food_log_entries")).toBe(0);
      expect(requestsTo("day_logs")).toBe(0);
    });

    it("should read the diary once the terms are accepted", async () => {
      await renderLoadedDiary();

      expect(requestsTo("food_log_entries")).toBeGreaterThan(0);
      expect(requestsTo("day_logs")).toBeGreaterThan(0);
    });
  });

  describe("opening scrolled", () => {
    // The scroll view's mock keeps its calls from one test to the next.
    beforeEach(() => {
      jest.spyOn(ScrollView.prototype, "scrollTo").mockClear();
    });

    // The hours are 100 points apart in these layouts, with the list 50 points down the log.
    async function layOutHours() {
      const [firstHour] = hourItems();
      if (firstHour?.parent) {
        await fireEvent(firstHour.parent, "layout", {
          nativeEvent: { layout: { x: 0, y: 50, width: 358, height: 2400 } },
        });
      }
      for (const [hour, item] of hourItems().entries()) {
        await fireEvent(item, "layout", {
          nativeEvent: { layout: { x: 0, y: hour * 100, width: 358, height: 100 } },
        });
      }
    }

    it("should scroll to the first food's hour, 8 points under the top, once the hours are measured", async () => {
      const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");
      await renderLoadedDiary();

      await layOutHours();

      // The first food is at 08:00, 800 points into the list, which is 50 points down.
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ y: 50 + 800 - 8, animated: false });
    });

    it("should scroll to the current hour on an empty day", async () => {
      diaryBackend.entries = [];
      const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");
      await renderLoadedDiary();

      await layOutHours();

      expect(scrollTo).toHaveBeenCalledWith({ y: 50 + 1100 - 8, animated: false });
    });

    it("should not scroll before all 24 hours are measured", async () => {
      const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");
      await renderLoadedDiary();

      const [, , , , , , , , eight] = hourItems();
      if (eight) {
        await fireEvent(eight, "layout", {
          nativeEvent: { layout: { x: 0, y: 800, width: 358, height: 100 } },
        });
      }

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});
