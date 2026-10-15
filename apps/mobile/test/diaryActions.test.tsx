import "./support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
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
import { setUpTests } from "react-native-reanimated";

import { DiaryScreen } from "../components/DiaryScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  foodEntry,
  requestsTo,
  resetDiaryBackend,
  sampleDay,
} from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { expectTextsInOrder } from "./support/textsInOrder";

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

setUpTests();

const today = "2026-10-15";
const yesterday = "2026-10-14";

// Yesterday is the sample day and a salmon supper at 19:15, which makes the board's eight entries.
function yesterdaysEntries() {
  return [
    ...sampleDay(yesterday),
    foodEntry({
      date: yesterday,
      utcTime: "18:15",
      name: "Salmon fillet, baked",
      quantity: 120,
      unit: "g",
      kcal: 247,
      protein: 25,
      fat: 16,
      carbs: 0,
    }),
  ];
}

// The row of the sample day that the delete tests act on, in the order `sampleDay` lists it.
const CHICKEN_INDEX = 3;
const idOfEntry = (index: number) => String(diaryBackend.entries[index]?.["id"]);

let queryClient: QueryClient;

async function renderLoadedDiary() {
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
  await screen.findByRole("button", { name: "Add food at 08:00" });
}

async function goOffline() {
  await act(() => {
    onlineManager.setOnline(false);
  });
}

// The time and amount line of every food row on screen, in the order the log lists them.
const captions = () => screen.queryAllByText(/^\d\d:\d\d · /);

const chickenRow = () => screen.getByRole("button", { name: /^Chicken breast, grilled/ });
const deleteAction = { name: "delete", label: "Delete" };

async function deleteChicken() {
  await fireEvent(chickenRow(), "accessibilityAction", { nativeEvent: { actionName: "delete" } });
}

describe("the diary's actions", () => {
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

  describe("deleting a food", () => {
    it("should take the food out of the log at once and say Entry deleted, with Undo", async () => {
      await renderLoadedDiary();

      await deleteChicken();

      expect(await screen.findByRole("status", { name: "Entry deleted" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: /^Chicken breast, grilled/ }),
      ).not.toBeOnTheScreen();
      expect(captions()).toHaveLength(6);
    });

    it("should delete exactly that entry and no other", async () => {
      await renderLoadedDiary();
      const chickenId = idOfEntry(CHICKEN_INDEX);

      await deleteChicken();
      await screen.findByRole("status", { name: "Entry deleted" });

      const deleted = diaryBackend.entries.filter((entry) => entry["deleted_at"] != null);
      expect(deleted.map((entry) => entry["id"])).toEqual([chickenId]);
    });

    it("should put exactly that entry back, at its time, when Undo is pressed", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();
      const chickenId = idOfEntry(CHICKEN_INDEX);
      await deleteChicken();

      await user.press(await screen.findByRole("button", { name: "Undo" }));

      expect(await screen.findByText("12:40 · 150 g")).toBeOnTheScreen();
      expect(captions()).toHaveLength(7);
      expect(diaryBackend.entries.filter((entry) => entry["deleted_at"] != null)).toEqual([]);
      const updates = diaryBackend.writes.filter((write) => write.method === "PATCH");
      expect(updates.map((write) => write.search)).toEqual([
        expect.stringContaining(`id=eq.${chickenId}`),
        expect.stringContaining(`id=eq.${chickenId}`),
      ]);
    });

    it("should close the toast once Undo is pressed", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();
      await deleteChicken();

      await user.press(await screen.findByRole("button", { name: "Undo" }));

      expect(screen.queryByRole("status", { name: "Entry deleted" })).not.toBeOnTheScreen();
    });

    it("should keep the food and show no toast when the delete fails", async () => {
      diaryBackend.failingWriteTables.add("food_log_entries");
      await renderLoadedDiary();

      await deleteChicken();

      expect(await screen.findByText("12:40 · 150 g")).toBeOnTheScreen();
      await waitFor(() => {
        expect(diaryBackend.writes).toHaveLength(1);
      });
      expect(screen.queryByRole("status", { name: "Entry deleted" })).not.toBeOnTheScreen();
      expect(captions()).toHaveLength(7);
    });

    it("should keep the first delete's toast and Undo when a second delete follows before it is saved", async () => {
      // Each update waits to be let go, so both deletes are asked for before either is saved.
      diaryBackend.holdUpdates = true;
      await renderLoadedDiary();
      await deleteChicken();
      await fireEvent(
        screen.getByRole("button", { name: /^Porridge oats/ }),
        "accessibilityAction",
        { nativeEvent: { actionName: "delete" } },
      );
      await waitFor(() => {
        expect(diaryBackend.heldUpdates).toHaveLength(1);
      });

      // The first is saved and the second is still waiting: the first one's toast is shown.
      const [saveFirst] = diaryBackend.heldUpdates;
      await act(() => {
        saveFirst?.();
      });

      expect(await screen.findByRole("status", { name: "Entry deleted" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
      expect(diaryBackend.heldUpdates).toHaveLength(2);
    });

    it("should offer Delete on a row, as its accessibility action", async () => {
      await renderLoadedDiary();

      expect(chickenRow()).toHaveProp("accessibilityActions", [deleteAction]);
    });

    it("should offer no Delete while offline, where a change could not be saved", async () => {
      await renderLoadedDiary();
      await goOffline();

      expect(chickenRow()).not.toHaveProp("accessibilityActions", [deleteAction]);
    });
  });

  describe("Copy yesterday from the empty day", () => {
    beforeEach(() => {
      diaryBackend.entries = yesterdaysEntries();
    });

    const copyYesterdayButton = () => screen.getByRole("button", { name: "Copy yesterday" });

    it("should copy the whole of yesterday onto the day, each food at its clock time", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();

      await user.press(copyYesterdayButton());

      expect(
        await screen.findByRole("status", { name: "Copied 8 entries from yesterday" }),
      ).toBeOnTheScreen();
      await waitFor(() => {
        expect(captions()).toHaveLength(8);
      });
      expectTextsInOrder(captions(), [
        "08:05 · 50 g",
        "08:05 · 200 ml",
        "08:10 · 1 medium (100 g)",
        "12:40 · 150 g",
        "12:40 · 180 g",
        "12:45 · Quick add",
        "15:20 · 170 g",
        "19:15 · 120 g",
      ]);
    });

    it("should leave yesterday's own entries as they were", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();

      await user.press(copyYesterdayButton());
      await screen.findByRole("status", { name: "Copied 8 entries from yesterday" });

      const yesterdays = diaryBackend.entries.filter((entry) => entry["local_date"] === yesterday);
      expect(yesterdays).toHaveLength(8);
      expect(yesterdays.every((entry) => entry["deleted_at"] == null)).toBe(true);
    });

    it("should take the copies back, and nothing else, when Undo is pressed", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();
      await user.press(copyYesterdayButton());
      await user.press(await screen.findByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(screen.getByText("Nothing logged yet")).toBeOnTheScreen();
      });
      const onToday = diaryBackend.entries.filter((entry) => entry["local_date"] === today);
      expect(onToday).toHaveLength(8);
      expect(onToday.every((entry) => entry["deleted_at"] != null)).toBe(true);
      const yesterdays = diaryBackend.entries.filter((entry) => entry["local_date"] === yesterday);
      expect(yesterdays.every((entry) => entry["deleted_at"] == null)).toBe(true);
    });

    it("should show the error banner, and no toast, when the copy fails", async () => {
      const user = userEvent.setup();
      diaryBackend.failingInsertsFrom = 1;
      await renderLoadedDiary();

      await user.press(copyYesterdayButton());

      const banner = await screen.findByRole("alert");
      expect(
        within(banner).getByText("Not copied. Check your connection and try again."),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("status", { name: /^Copied/ })).not.toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
    });

    it("should leave the button to try again, and drop the banner once the copy works", async () => {
      const user = userEvent.setup();
      diaryBackend.failingInsertsFrom = 1;
      await renderLoadedDiary();
      await user.press(copyYesterdayButton());
      await screen.findByRole("alert");
      diaryBackend.failingInsertsFrom = null;

      await user.press(copyYesterdayButton());

      expect(
        await screen.findByRole("status", { name: "Copied 8 entries from yesterday" }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should take back the copies a failed copy left, so Not copied is true", async () => {
      const user = userEvent.setup();
      // The third insert fails, and so does the first attempt to take back the first two.
      diaryBackend.failingInsertsFrom = 3;
      diaryBackend.failingUpdates = 1;
      await renderLoadedDiary();

      await user.press(copyYesterdayButton());

      await screen.findByRole("alert");
      await waitFor(() => {
        const copies = diaryBackend.entries.filter((entry) => entry["local_date"] === today);
        expect(copies).toHaveLength(2);
        expect(copies.every((entry) => entry["deleted_at"] != null)).toBe(true);
      });
    });

    it("should drop the banner when another day is shown", async () => {
      const user = userEvent.setup();
      diaryBackend.failingInsertsFrom = 1;
      await renderLoadedDiary();
      await user.press(copyYesterdayButton());
      await screen.findByRole("alert");

      await user.press(screen.getByRole("button", { name: "Wednesday 14 October" }));

      await screen.findByRole("heading", { name: "Wed 14 Oct" });
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    // The empty day's button is enabled while yesterday is not yet known, so a copy can find it empty.
    it("should show no toast when the copy finds yesterday empty after all", async () => {
      const user = userEvent.setup();
      diaryBackend.entries = [];
      diaryBackend.hungEntryReadsOnce.add(yesterday);
      await renderLoadedDiary();

      await user.press(copyYesterdayButton());

      await waitFor(() => {
        const readsOfYesterday = diaryBackend.requests.filter(
          (request) =>
            request.table === "food_log_entries" &&
            request.search.includes(`local_date=eq.${yesterday}`),
        );
        expect(readsOfYesterday).toHaveLength(2);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(screen.queryByText(/^Copied/)).not.toBeOnTheScreen();
      expect(diaryBackend.writes).toEqual([]);
    });

    it("should disable the button while offline", async () => {
      await renderLoadedDiary();
      await goOffline();

      expect(copyYesterdayButton()).toBeDisabled();
    });
  });

  describe("the More menu", () => {
    const moreButton = () => screen.getByRole("button", { name: "More" });
    const menuItem = () => screen.getByRole("button", { name: /^Copy yesterday/ });

    it("should open with the one item, Copy yesterday, enabled when yesterday has foods", async () => {
      const user = userEvent.setup();
      diaryBackend.entries = [...sampleDay(), ...yesterdaysEntries()];
      await renderLoadedDiary();

      await user.press(moreButton());

      expect(await screen.findByRole("button", { name: "Copy yesterday" })).toBeEnabled();
      expect(screen.queryByText("Nothing logged yesterday")).not.toBeOnTheScreen();
    });

    it("should copy the whole day onto the day shown, after what is there, and close", async () => {
      const user = userEvent.setup();
      diaryBackend.entries = [...sampleDay(), ...yesterdaysEntries()];
      await renderLoadedDiary();
      await user.press(moreButton());

      await user.press(await screen.findByRole("button", { name: "Copy yesterday" }));

      expect(
        await screen.findByRole("status", { name: "Copied 8 entries from yesterday" }),
      ).toBeOnTheScreen();
      await waitFor(() => {
        expect(captions()).toHaveLength(15);
      });
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: /^Copy yesterday/ })).not.toBeOnTheScreen();
      });
    });

    it("should take back exactly the copies with Undo and keep what was logged since", async () => {
      const user = userEvent.setup();
      diaryBackend.entries = [...sampleDay(), ...yesterdaysEntries()];
      await renderLoadedDiary();
      await user.press(moreButton());
      await user.press(await screen.findByRole("button", { name: "Copy yesterday" }));
      await user.press(await screen.findByRole("button", { name: "Undo" }));
      await waitFor(() => {
        expect(captions()).toHaveLength(7);
      });

      const onToday = diaryBackend.entries.filter((entry) => entry["local_date"] === today);
      expect(onToday).toHaveLength(15);
      expect(onToday.filter((entry) => entry["deleted_at"] == null)).toHaveLength(7);
    });

    it("should disable Copy yesterday and say why when yesterday is empty", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();

      await user.press(moreButton());

      expect(await screen.findByText("Nothing logged yesterday")).toBeOnTheScreen();
      expect(menuItem()).toBeDisabled();
    });

    it("should disable Copy yesterday, with no caption yet, while yesterday is still loading", async () => {
      const user = userEvent.setup();
      diaryBackend.entries = [...sampleDay(), ...yesterdaysEntries()];
      diaryBackend.hungEntryReadsOnce.add(yesterday);
      await renderLoadedDiary();

      await user.press(moreButton());

      const item = await screen.findByRole("button", { name: "Copy yesterday" });
      expect(item).toBeDisabled();
      expect(screen.queryByText("Nothing logged yesterday")).not.toBeOnTheScreen();
      await user.press(item);
      expect(diaryBackend.writes).toEqual([]);
    });

    it("should copy nothing when the disabled item is pressed", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();
      await user.press(moreButton());
      await screen.findByText("Nothing logged yesterday");

      await user.press(menuItem());

      expect(diaryBackend.writes).toEqual([]);
    });

    it("should disable Copy yesterday while offline", async () => {
      const user = userEvent.setup();
      diaryBackend.entries = [...sampleDay(), ...yesterdaysEntries()];
      await renderLoadedDiary();
      await goOffline();

      await user.press(moreButton());

      expect(await screen.findByRole("button", { name: "Copy yesterday" })).toBeDisabled();
    });

    it("should read yesterday only when the menu is opened on a day with foods", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();
      const entryReadsBefore = requestsTo("food_log_entries");

      await user.press(moreButton());
      await screen.findByText("Nothing logged yesterday");

      expect(requestsTo("food_log_entries")).toBeGreaterThan(entryReadsBefore);
    });
  });

  describe("the date picker", () => {
    const calendarButton = () => screen.getByRole("button", { name: "Choose a date" });

    async function openPicker() {
      const user = userEvent.setup();
      await renderLoadedDiary();
      await user.press(calendarButton());
      await screen.findByRole("heading", { name: "October 2026" });
      return user;
    }

    it("should open on the month of the day shown, with today chosen", async () => {
      await openPicker();

      expect(screen.getByRole("button", { name: "15 October, today, selected" })).toBeOnTheScreen();
    });

    it("should dot the complete days that the diary reads for the month", async () => {
      diaryBackend.dayLogs = [
        {
          local_date: "2026-10-12",
          is_complete: true,
          completed_at: "2026-10-12T20:00:00+00:00",
          note: null,
        },
        {
          local_date: "2026-10-13",
          is_complete: true,
          completed_at: "2026-10-13T20:00:00+00:00",
          note: null,
        },
        { local_date: "2026-10-14", is_complete: false, completed_at: null, note: null },
      ];
      await openPicker();

      expect(await screen.findByRole("button", { name: "12 October, complete" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "13 October, complete" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "14 October" })).toBeOnTheScreen();
    });

    it("should make no request for the complete days until it is opened", async () => {
      await renderLoadedDiary();

      expect(
        diaryBackend.requests.filter((request) => request.search.includes("is_complete=eq.true")),
      ).toEqual([]);
    });

    it("should ask for the complete days of the month it shows", async () => {
      await openPicker();

      await waitFor(() => {
        expect(
          diaryBackend.requests.some(
            (request) =>
              request.search.includes("is_complete=eq.true") &&
              request.search.includes("local_date=gte.2026-10-01"),
          ),
        ).toBe(true);
      });
    });

    it("should show the day chosen as the title and on the strip, and close", async () => {
      const user = await openPicker();

      await user.press(screen.getByRole("button", { name: "9 October" }));

      expect(await screen.findByRole("heading", { name: "Fri 9 Oct" })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Friday 9 October", selected: true }),
      ).toBeOnTheScreen();
      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "October 2026" })).not.toBeOnTheScreen();
      });
    });

    it("should send the chosen day to food search from an hour's plus", async () => {
      const user = await openPicker();
      await user.press(screen.getByRole("button", { name: "9 October" }));
      await screen.findByRole("heading", { name: "Fri 9 Oct" });

      await user.press(await screen.findByRole("button", { name: "Add food at 12:00" }));

      expect(routerMock.push).toHaveBeenCalledWith("/foods?day=2026-10-09&time=12:00");
    });

    it("should reach a day in an earlier month by the previous month button", async () => {
      const user = await openPicker();

      await user.press(screen.getByRole("button", { name: "Previous month" }));
      await user.press(await screen.findByRole("button", { name: "30 September" }));

      expect(await screen.findByRole("heading", { name: "Wed 30 Sep" })).toBeOnTheScreen();
    });

    it("should open on the month of the day shown the next time", async () => {
      const user = await openPicker();
      await user.press(screen.getByRole("button", { name: "Previous month" }));
      await user.press(await screen.findByRole("button", { name: "30 September" }));
      await screen.findByRole("heading", { name: "Wed 30 Sep" });
      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "September 2026" })).not.toBeOnTheScreen();
      });

      await user.press(calendarButton());

      expect(await screen.findByRole("heading", { name: "September 2026" })).toBeOnTheScreen();
    });

    it("should go back to Today when today is chosen", async () => {
      const user = await openPicker();
      await user.press(screen.getByRole("button", { name: "9 October" }));
      await screen.findByRole("heading", { name: "Fri 9 Oct" });
      await user.press(calendarButton());

      await user.press(await screen.findByRole("button", { name: "15 October, today" }));

      expect(await screen.findByRole("heading", { name: "Today" })).toBeOnTheScreen();
    });

    it("should not offer a day after today, nor the month after", async () => {
      await openPicker();

      expect(screen.getByRole("button", { name: "16 October" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
    });
  });

  describe("the day complete switch", () => {
    const toggle = () => screen.getByRole("switch");
    const todayPill = (isComplete: boolean) =>
      screen.queryByRole("button", {
        name: `Thursday 15 October, today${isComplete ? ", complete" : ""}`,
      });

    it("should mark the day complete on one press, and the strip's check shows at once", async () => {
      const user = userEvent.setup();
      // The server never answers, so only the cache can have changed what is on screen.
      diaryBackend.hungWriteTables.add("day_logs");
      await renderLoadedDiary();
      expect(todayPill(true)).not.toBeOnTheScreen();

      await user.press(toggle());

      expect(
        await screen.findByRole("button", { name: "Thursday 15 October, today, complete" }),
      ).toBeOnTheScreen();
      expect(toggle()).toBeChecked();
      expect(screen.getByText("Day complete")).toBeOnTheScreen();
    });

    it("should save the day as complete", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();

      await user.press(toggle());

      await waitFor(() => {
        expect(diaryBackend.dayLogs).toEqual([
          expect.objectContaining({ local_date: today, is_complete: true }),
        ]);
      });
    });

    it("should mark the day not complete on a second press", async () => {
      const user = userEvent.setup();
      diaryBackend.dayLogs = [
        {
          local_date: today,
          is_complete: true,
          completed_at: "2026-10-15T09:00:00+00:00",
          note: null,
        },
      ];
      await renderLoadedDiary();
      expect(toggle()).toBeChecked();

      await user.press(toggle());

      await waitFor(() => {
        expect(toggle()).not.toBeChecked();
      });
      await waitFor(() => {
        expect(diaryBackend.dayLogs).toEqual([
          expect.objectContaining({ local_date: today, is_complete: false, completed_at: null }),
        ]);
      });
    });

    it("should mark the day on view, not today, when another day is shown", async () => {
      const user = userEvent.setup();
      await renderLoadedDiary();
      await user.press(screen.getByRole("button", { name: "Wednesday 14 October" }));
      await screen.findByRole("heading", { name: "Wed 14 Oct" });

      await user.press(await screen.findByRole("switch"));

      await waitFor(() => {
        expect(diaryBackend.dayLogs).toEqual([
          expect.objectContaining({ local_date: yesterday, is_complete: true }),
        ]);
      });
    });

    // The log is keyed by the day. Without that, the switch would live on across days, and the moment of
    // a press on one day would still be playing on the next day it shows.
    describe("when the day shown changes", () => {
      const slash = () =>
        screen.queryByTestId("day-complete-slash", { includeHiddenElements: true });
      const yesterdayPill = () => screen.getByRole("button", { name: /^Wednesday 14 October/ });
      const todayPill = () => screen.getByRole("button", { name: /^Thursday 15 October, today/ });

      // Visits yesterday and comes back, so its day is in the cache and shows with no loading between.
      async function visitYesterdayAndReturn(user: ReturnType<typeof userEvent.setup>) {
        await renderLoadedDiary();
        await user.press(yesterdayPill());
        await screen.findByRole("heading", { name: "Wed 14 Oct" });
        await screen.findByRole("switch");
        await user.press(todayPill());
        await screen.findByRole("heading", { name: "Today" });
      }

      it("should not play a press's moment again on a day that is already complete", async () => {
        const user = userEvent.setup();
        diaryBackend.dayLogs = [
          {
            local_date: yesterday,
            is_complete: true,
            completed_at: "2026-10-14T20:00:00+00:00",
            note: null,
          },
        ];
        // The save is never answered, so the press is still in flight when the day changes.
        diaryBackend.hungWriteTables.add("day_logs");
        await visitYesterdayAndReturn(user);
        await user.press(screen.getByRole("switch"));
        await waitFor(() => {
          expect(slash()).toBeOnTheScreen();
        });

        await user.press(yesterdayPill());

        await screen.findByRole("heading", { name: "Wed 14 Oct" });
        expect(screen.getByRole("switch")).toBeChecked();
        expect(slash()).not.toBeOnTheScreen();
      });

      it("should not play the moment when the day shown then becomes complete from outside", async () => {
        const user = userEvent.setup();
        diaryBackend.hungWriteTables.add("day_logs");
        await visitYesterdayAndReturn(user);
        await user.press(screen.getByRole("switch"));
        await user.press(yesterdayPill());
        await screen.findByRole("heading", { name: "Wed 14 Oct" });

        diaryBackend.dayLogs = [
          {
            local_date: yesterday,
            is_complete: true,
            completed_at: "2026-10-14T20:00:00+00:00",
            note: null,
          },
        ];
        await act(() => queryClient.invalidateQueries());

        await waitFor(() => {
          expect(screen.getByRole("switch")).toBeChecked();
        });
        expect(slash()).not.toBeOnTheScreen();
      });
    });

    it("should put the switch and the check back when the save fails", async () => {
      const user = userEvent.setup();
      diaryBackend.failingWriteTables.add("day_logs");
      await renderLoadedDiary();

      await user.press(toggle());

      await waitFor(() => {
        expect(diaryBackend.writes.length).toBeGreaterThan(0);
      });
      await waitFor(() => {
        expect(toggle()).not.toBeChecked();
      });
      expect(todayPill(true)).not.toBeOnTheScreen();
      expect(todayPill(false)).toBeOnTheScreen();
    });
  });
});
