import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { diaryDay, noTargets, overTargetDay, quickEntry, sampleDay, targets } from "./support";

import type { CopiedDay, DiaryDay, DiaryWeekDay, LogEntry, Targets } from "@keylow/api-client";

import { DiaryScreen } from "@/components/diary";
import { ToastProvider } from "@/components/ui/Toast";

type Query<Data> = {
  data: Data | undefined;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<unknown>;
};

type Backend = {
  timeZone: Query<string | null>;
  days: Map<string, Query<DiaryDay>>;
  targets: Query<Targets>;
  week: Query<DiaryWeekDay[]>;
  completeDays: Query<string[]>;
  dayReads: { date: string; enabled: boolean | undefined }[];
  monthReads: string[];
};

const backend = vi.hoisted((): Backend => {
  const idle = <Data,>(): Query<Data> => ({
    data: undefined,
    isError: false,
    isSuccess: false,
    refetch: () => Promise.resolve(),
  });

  return {
    timeZone: idle(),
    days: new Map(),
    targets: idle(),
    week: idle(),
    completeDays: idle(),
    dayReads: [],
    monthReads: [],
  };
});

const refetch = vi.fn<() => Promise<unknown>>();
const settled = <Data,>(data: Data): Query<Data> => ({
  data,
  isError: false,
  isSuccess: true,
  refetch,
});
const waiting = <Data,>(): Query<Data> => ({
  data: undefined,
  isError: false,
  isSuccess: false,
  refetch,
});
const failed = <Data,>(): Query<Data> => ({
  data: undefined,
  isError: true,
  isSuccess: false,
  refetch,
});

const {
  push,
  openAddFood,
  openEditEntry,
  setViewedDate,
  deleteEntry,
  restoreEntry,
  copyDay,
  undoCopyDay,
  setDayComplete,
} = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  openAddFood: vi.fn<(request: { date: string; time?: string }) => void>(),
  openEditEntry: vi.fn<(entryId: string) => void>(),
  setViewedDate: vi.fn<(date: string | undefined) => void>(),
  deleteEntry: {
    mutate: vi.fn<(entry: LogEntry, options: { onError: () => void }) => void>(),
    isPending: false,
  },
  restoreEntry: {
    mutate: vi.fn<(entry: LogEntry, options: { onError: () => void }) => void>(),
    isPending: false,
  },
  copyDay: {
    mutate:
      vi.fn<
        (
          input: { from: string; to: string; timeZone: string },
          options: { onSuccess: (copied: CopiedDay) => void; onError: () => void },
        ) => void
      >(),
    isPending: false,
  },
  undoCopyDay: {
    mutate: vi.fn<(copied: CopiedDay, options: { onError: () => void }) => void>(),
    isPending: false,
  },
  setDayComplete: {
    mutate: vi.fn<(input: { localDate: string; complete: boolean }) => void>(),
    isPending: false,
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@/lib/foodLogActions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/foodLogActions")>()),
  useFoodLogActions: () => ({
    openAddFood,
    openEditEntry,
    setViewedDate,
    viewedDate: undefined,
  }),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => backend.timeZone,
  useDiaryDay: (date: string, options?: { enabled?: boolean }) => {
    backend.dayReads.push({ date, enabled: options?.enabled });
    return options?.enabled === false ? waiting() : (backend.days.get(date) ?? waiting());
  },
  useDiaryWeek: () => backend.week,
  useTargets: () => backend.targets,
  useCompleteDays: (month: string) => {
    backend.monthReads.push(month);
    return backend.completeDays;
  },
  useDeleteEntry: () => deleteEntry,
  useRestoreEntry: () => restoreEntry,
  useCopyDay: () => copyDay,
  useUndoCopyDay: () => undoCopyDay,
  useSetDayComplete: () => setDayComplete,
}));

const TODAY = "2026-10-15";
const scrollIntoView = vi.fn();

function weekOfThursday15(completeDates: string[] = []): DiaryWeekDay[] {
  return ["12", "13", "14", "15", "16", "17", "18"].map((day) => {
    const localDate = `2026-10-${day}`;
    return {
      localDate,
      dayLog: completeDates.includes(localDate)
        ? { local_date: localDate, is_complete: true, completed_at: null, note: null }
        : null,
      totals: null,
    };
  });
}

function showDay(date: string, entries = sampleDay(date), isComplete = false) {
  backend.days.set(date, settled<DiaryDay>(diaryDay(date, entries, isComplete)));
}

function setTargets(value: Targets) {
  backend.targets = settled(value);
}

function renderDiary(props: { date?: string | undefined; view?: "day" | "week" } = {}) {
  return render(
    <ToastProvider>
      <DiaryScreen date={props.date} view={props.view ?? "day"} />
    </ToastProvider>,
  );
}

// The entries the screen was given, as it was given them: their ids are what Edit hands over.
const entryOnShow = (index: number) => backend.days.get(TODAY)?.data?.entries[index];
const strip = () => screen.getByRole("button", { name: /^Targets\./ });
const tableOf = (hour: string) => screen.getByRole("table", { name: `Foods at ${hour}` });

beforeEach(() => {
  vi.resetAllMocks();
  // 11:20 on Thursday 15 October 2026, so the current hour is 11:00.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T11:20:00Z"));
  Element.prototype.scrollIntoView = scrollIntoView;
  backend.timeZone = settled("UTC");
  backend.days.clear();
  backend.dayReads = [];
  backend.monthReads = [];
  backend.week = settled(weekOfThursday15(["2026-10-12", "2026-10-13"]));
  backend.completeDays = settled(["2026-10-12", "2026-10-13"]);
  setTargets(targets);
  showDay(TODAY);
  showDay("2026-10-14", []);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the diary screen", () => {
  describe("today", () => {
    it("should be headed Today, with the calendar button and the Day and Week control", () => {
      renderDiary();

      expect(screen.getByRole("heading", { level: 1, name: "Today" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Choose a date" })).toBeTruthy();
      const view = screen.getByRole("radiogroup", { name: "View" });
      expect(within(view).getByRole("radio", { name: "Day" })).toHaveProperty("checked", true);
      expect(within(view).getByRole("radio", { name: "Week" })).toHaveProperty("checked", false);
    });

    it("should draw the week Monday to Sunday, today selected, a complete day marked and later days dimmed", () => {
      renderDiary();

      expect(screen.getByRole("button", { name: "Monday 12 October, complete" })).toBeTruthy();
      expect(
        screen
          .getByRole("button", { name: "Thursday 15 October, today" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        screen.getByRole("button", { name: "Friday 16 October" }).getAttribute("aria-disabled"),
      ).toBe("true");
    });

    it("should draw the four bars from the day's foods against the targets, as one button named Targets", () => {
      renderDiary();

      expect(strip().getAttribute("aria-label")).toBe(
        "Targets. Calories: 1,039 of 2,200 kilocalories. Protein: 86 of 160 grams. Carbohydrate: 129 of 220 grams. Fat: 19 of 70 grams",
      );
    });

    it("should open Targets from the bars", () => {
      renderDiary();

      fireEvent.click(strip());

      expect(push).toHaveBeenCalledExactlyOnceWith("/more/targets");
    });

    it("should list all 24 hours, grouped by what is in them", () => {
      renderDiary();

      expect(screen.getAllByRole("group", { name: /^\d{2}:00, / })).toHaveLength(24);
      expect(screen.getByRole("group", { name: "08:00, 3 foods" })).toBeTruthy();
      expect(screen.getByRole("group", { name: "12:00, 3 foods" })).toBeTruthy();
      expect(screen.getByRole("group", { name: "09:00, nothing logged" })).toBeTruthy();
      expect(screen.getByRole("group", { name: "23:00, nothing logged" })).toBeTruthy();
    });

    it("should put the day's foods in a table of each hour, with their time and amount", () => {
      renderDiary();

      const table = within(tableOf("08:00"));

      expect(table.getAllByRole("row")).toHaveLength(4);
      expect(
        within(table.getByRole("row", { name: /Porridge oats/ })).getByText("08:05 · 50 g"),
      ).toBeTruthy();
      expect(
        within(table.getByRole("row", { name: /Banana/ })).getByText("08:10 · 1 medium (100 g)"),
      ).toBeTruthy();
    });

    it("should write a quick add by its label", () => {
      renderDiary();

      expect(within(tableOf("12:00")).getByText("Meal deal crisps")).toBeTruthy();
      expect(within(tableOf("12:00")).getByText("12:45 · Quick add")).toBeTruthy();
    });

    it("should carry the dot on the current hour only", () => {
      renderDiary();

      const dots = screen.getAllByRole("img", { name: "Current hour" });

      expect(dots).toHaveLength(1);
      expect(
        screen.getByRole("group", { name: "11:00, nothing logged" }).contains(dots[0] ?? null),
      ).toBe(true);
    });

    it("should scroll once to the hour of the first food", () => {
      renderDiary();

      expect(scrollIntoView).toHaveBeenCalledOnce();
      expect(scrollIntoView.mock.contexts[0]).toBe(
        screen.getByRole("group", { name: "08:00, 3 foods" }),
      );
    });

    it("should not scroll again when the screen draws again", () => {
      const { rerender } = renderDiary();

      rerender(
        <ToastProvider>
          <DiaryScreen date={undefined} view="day" />
        </ToastProvider>,
      );

      expect(scrollIntoView).toHaveBeenCalledOnce();
    });

    it("should tell the top bar which day is on view, and forget it when the diary goes", () => {
      const { unmount } = renderDiary();

      expect(setViewedDate).toHaveBeenLastCalledWith(TODAY);

      unmount();

      expect(setViewedDate).toHaveBeenLastCalledWith(undefined);
    });
  });

  describe("adding food at an hour", () => {
    it("should draw a plus on every hour, named for the hour", () => {
      renderDiary();

      expect(screen.getAllByRole("button", { name: /^Add food at / })).toHaveLength(24);
      expect(screen.getByRole("button", { name: "Add food at 12:00" })).toBeTruthy();
    });

    it("should open the add dialog for the day on the hour that was pressed", () => {
      renderDiary();

      fireEvent.click(screen.getByRole("button", { name: "Add food at 12:00" }));

      expect(openAddFood).toHaveBeenCalledExactlyOnceWith({ date: TODAY, time: "12:00" });
    });

    it("should write the hour with a leading zero", () => {
      renderDiary();

      fireEvent.click(screen.getByRole("button", { name: "Add food at 07:00" }));

      expect(openAddFood).toHaveBeenCalledExactlyOnceWith({ date: TODAY, time: "07:00" });
    });

    it("should add to the day on view, not to today", () => {
      renderDiary({ date: "2026-10-14" });

      fireEvent.click(screen.getByRole("button", { name: "Add food at 08:00" }));

      expect(openAddFood).toHaveBeenCalledExactlyOnceWith({ date: "2026-10-14", time: "08:00" });
    });
  });

  describe("editing an entry", () => {
    it("should open the edit dialog for the entry whose Edit button is pressed", () => {
      renderDiary();
      const porridge = entryOnShow(0);

      fireEvent.click(within(tableOf("08:00")).getByRole("button", { name: "Edit Porridge oats" }));

      expect(openEditEntry).toHaveBeenCalledExactlyOnceWith(porridge?.id);
    });

    it("should open the edit dialog from a press on a stacked row", () => {
      renderDiary();
      const stacked = within(screen.getByRole("region", { name: "Foods at 08:00" })).getByRole(
        "list",
      );
      const banana = entryOnShow(2);

      fireEvent.click(within(stacked).getByRole("button", { name: /Banana/ }));

      expect(openEditEntry).toHaveBeenCalledExactlyOnceWith(banana?.id);
    });

    it("should not open anything when a row is only looked at", () => {
      renderDiary();

      expect(openEditEntry).not.toHaveBeenCalled();
      expect(openAddFood).not.toHaveBeenCalled();
    });
  });

  describe("a row's Delete", () => {
    it("should be a button the keyboard reaches, shown on focus within the row", () => {
      renderDiary();
      const remove = within(tableOf("08:00")).getByRole("button", { name: "Delete Porridge oats" });

      remove.focus();

      expect(document.activeElement).toBe(remove);
      expect(remove.tabIndex).toBe(0);
      expect(remove.parentElement?.className).toContain("group-focus-within/row:opacity-100");
      expect(remove.parentElement?.className).toContain("group-hover/row:opacity-100");
    });

    it("should delete at once and offer Undo", () => {
      renderDiary();

      fireEvent.click(
        within(tableOf("08:00")).getByRole("button", { name: "Delete Porridge oats" }),
      );

      expect(deleteEntry.mutate).toHaveBeenCalledOnce();
      expect(screen.getByText("Entry deleted")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    });

    it("should bring the entry back with Undo", () => {
      renderDiary();
      fireEvent.click(
        within(tableOf("08:00")).getByRole("button", { name: "Delete Porridge oats" }),
      );
      const deleted = deleteEntry.mutate.mock.calls[0]?.[0];

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      expect(restoreEntry.mutate).toHaveBeenCalledOnce();
      expect(restoreEntry.mutate.mock.calls[0]?.[0]).toBe(deleted);
    });

    describe("by keyboard", () => {
      const deletePorridge = () =>
        within(tableOf("08:00")).getByRole("button", { name: "Delete Porridge oats" });

      function pressDeleteWithKeyboard() {
        fireEvent.keyDown(document, { key: "Enter" });
        deletePorridge().focus();
        fireEvent.click(deletePorridge());
      }

      it("should move focus to Undo", () => {
        renderDiary();

        pressDeleteWithKeyboard();

        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Undo" }));
      });

      it("should give focus to the next row when the toast is dismissed", () => {
        renderDiary();
        pressDeleteWithKeyboard();

        fireEvent.keyDown(screen.getByRole("button", { name: "Undo" }), { key: "Escape" });

        expect(document.activeElement).toBe(
          within(tableOf("08:00")).getByRole("button", { name: "Delete Semi-skimmed milk" }),
        );
      });

      it("should give focus to the next row when Undo is pressed, and bring the entry back", () => {
        renderDiary();
        pressDeleteWithKeyboard();

        fireEvent.click(screen.getByRole("button", { name: "Undo" }));

        expect(restoreEntry.mutate).toHaveBeenCalledOnce();
        expect(document.activeElement).toBe(
          within(tableOf("08:00")).getByRole("button", { name: "Delete Semi-skimmed milk" }),
        );
      });

      it("should announce the toast once", () => {
        renderDiary();

        pressDeleteWithKeyboard();

        expect(screen.getAllByText("Entry deleted")).toHaveLength(1);
        expect(screen.getAllByRole("status")).toHaveLength(1);
      });

      it("should leave focus alone after a pointer press", () => {
        renderDiary();
        fireEvent.pointerDown(deletePorridge());
        deletePorridge().focus();

        fireEvent.click(deletePorridge(), { detail: 1 });

        expect(document.activeElement).toBe(deletePorridge());
      });
    });

    it("should say so when a delete does not go through", () => {
      renderDiary();
      fireEvent.click(
        within(tableOf("08:00")).getByRole("button", { name: "Delete Porridge oats" }),
      );
      const options = deleteEntry.mutate.mock.calls[0]?.[1];

      act(() => {
        options?.onError();
      });

      expect(screen.getByText("Something went wrong. Try again.")).toBeTruthy();
    });
  });

  describe("marking the day complete", () => {
    it("should be a switch after the last hour, asking for complete with one press", () => {
      renderDiary();

      fireEvent.click(screen.getByRole("switch", { name: /Mark day complete/ }));

      expect(setDayComplete.mutate).toHaveBeenCalledExactlyOnceWith({
        localDate: TODAY,
        complete: true,
      });
    });

    it("should show a complete day as on, and play no moment for it", () => {
      showDay(TODAY, sampleDay(), true);
      renderDiary();

      expect(
        screen.getByRole("switch", { name: /Day complete/ }).getAttribute("aria-checked"),
      ).toBe("true");
      expect(screen.queryByTestId("day-complete-slash")).toBeNull();
    });

    it("should ask to unmark a complete day", () => {
      showDay(TODAY, sampleDay(), true);
      renderDiary();

      fireEvent.click(screen.getByRole("switch", { name: /Day complete/ }));

      expect(setDayComplete.mutate).toHaveBeenCalledExactlyOnceWith({
        localDate: TODAY,
        complete: false,
      });
    });

    it("should play no moment when the diary steps to a day that is already complete", () => {
      showDay("2026-10-13", sampleDay("2026-10-13"), true);
      const { rerender } = renderDiary();

      rerender(
        <ToastProvider>
          <DiaryScreen date="2026-10-13" view="day" />
        </ToastProvider>,
      );

      expect(screen.getByRole("switch", { name: /Day complete/ })).toBeTruthy();
      expect(screen.queryByTestId("day-complete-slash")).toBeNull();
    });

    it("should not let a press left unanswered play the moment on the next day", () => {
      showDay("2026-10-13", sampleDay("2026-10-13"), true);
      const { rerender } = renderDiary();
      fireEvent.click(screen.getByRole("switch", { name: /Mark day complete/ }));

      rerender(
        <ToastProvider>
          <DiaryScreen date="2026-10-13" view="day" />
        </ToastProvider>,
      );

      expect(screen.getByRole("switch", { name: /Day complete/ })).toBeTruthy();
      expect(screen.queryByTestId("day-complete-slash")).toBeNull();
    });

    it("should play the moment after a press that the day then accepts", () => {
      const { rerender } = renderDiary();
      fireEvent.click(screen.getByRole("switch", { name: /Mark day complete/ }));

      showDay(TODAY, sampleDay(), true);
      rerender(
        <ToastProvider>
          <DiaryScreen date={undefined} view="day" />
        </ToastProvider>,
      );

      expect(screen.queryByTestId("day-complete-slash")).not.toBeNull();
    });
  });

  describe("another day", () => {
    it("should be headed with its date, with no current hour", () => {
      renderDiary({ date: "2026-10-14" });

      expect(screen.getByRole("heading", { level: 1, name: "Wed 14 Oct" })).toBeTruthy();
      expect(screen.queryByRole("img", { name: "Current hour" })).toBeNull();
      expect(
        screen.getByRole("button", { name: "Wednesday 14 October" }).getAttribute("aria-pressed"),
      ).toBe("true");
    });

    it("should treat a day after today as today", () => {
      renderDiary({ date: "2026-10-20" });

      expect(screen.getByRole("heading", { level: 1, name: "Today" })).toBeTruthy();
    });

    it("should go to a day pressed on the strip", () => {
      renderDiary();

      fireEvent.click(screen.getByRole("button", { name: "Tuesday 13 October, complete" }));

      expect(push).toHaveBeenCalledExactlyOnceWith("/diary?date=2026-10-13");
    });

    it("should go to the bare diary for today", () => {
      renderDiary({ date: "2026-10-14" });

      fireEvent.click(screen.getByRole("button", { name: "Thursday 15 October, today" }));

      expect(push).toHaveBeenCalledExactlyOnceWith("/diary");
    });

    it("should keep the header and the strip on screen while the next day loads", () => {
      const { rerender } = renderDiary();
      backend.days.delete("2026-10-14");

      rerender(
        <ToastProvider>
          <DiaryScreen date="2026-10-14" view="day" />
        </ToastProvider>,
      );

      expect(screen.getByRole("heading", { level: 1, name: "Wed 14 Oct" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Monday 12 October, complete" })).toBeTruthy();
      expect(screen.getByRole("status", { name: "Loading your diary" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Targets\./ })).toBeNull();
    });
  });

  describe("choosing a date", () => {
    it("should open the date picker from the calendar button, with the complete days of the month", () => {
      renderDiary();

      fireEvent.click(screen.getByRole("button", { name: "Choose a date" }));

      const picker = screen.getByRole("dialog", { name: "Choose a date" });
      expect(within(picker).getByRole("button", { name: "13 October, complete" })).toBeTruthy();
      expect(backend.monthReads.at(-1)).toBe("2026-10");
    });

    it("should read no complete days until the picker is opened", () => {
      renderDiary();

      expect(backend.monthReads).toEqual([]);
    });

    it("should go to the day chosen in the picker", () => {
      renderDiary();
      fireEvent.click(screen.getByRole("button", { name: "Choose a date" }));

      fireEvent.click(
        within(screen.getByRole("dialog", { name: "Choose a date" })).getByRole("button", {
          name: "9 October",
        }),
      );

      expect(push).toHaveBeenCalledExactlyOnceWith("/diary?date=2026-10-09");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should load the complete days of another month when the picker moves to it", () => {
      renderDiary();
      fireEvent.click(screen.getByRole("button", { name: "Choose a date" }));

      fireEvent.click(screen.getByRole("button", { name: "Previous month" }));

      expect(backend.monthReads.at(-1)).toBe("2026-09");
    });
  });

  describe("the Day and Week control", () => {
    it("should go to the week view", () => {
      renderDiary();

      fireEvent.click(screen.getByRole("radio", { name: "Week" }));

      expect(push).toHaveBeenCalledExactlyOnceWith("/diary?view=week");
    });

    it("should come back from the week view to the same day", () => {
      renderDiary({ date: "2026-10-14", view: "week" });

      fireEvent.click(screen.getByRole("radio", { name: "Day" }));

      expect(push).toHaveBeenCalledExactlyOnceWith("/diary?date=2026-10-14");
    });

    it("should show the week as chosen and leave the day's log out", () => {
      renderDiary({ view: "week" });

      expect(screen.getByRole("radio", { name: "Week" })).toHaveProperty("checked", true);
      expect(screen.queryByRole("group", { name: "08:00, 3 foods" })).toBeNull();
    });
  });

  describe("a day with nothing logged", () => {
    beforeEach(() => {
      showDay(TODAY, []);
      showDay("2026-10-14", sampleDay("2026-10-14"));
    });

    it("should say nothing is logged and offer to copy yesterday", () => {
      renderDiary();

      const card = screen.getByRole("region", { name: "Nothing logged yet" });
      expect(within(card).getByRole("button", { name: "Copy yesterday" })).toBeTruthy();
    });

    it("should still list all 24 hours, and scroll to the current hour", () => {
      renderDiary();

      expect(screen.getAllByRole("group", { name: /^\d{2}:00, / })).toHaveLength(24);
      expect(scrollIntoView.mock.contexts[0]).toBe(
        screen.getByRole("group", { name: "11:00, nothing logged" }),
      );
    });

    it("should read yesterday only now that the day is empty", () => {
      renderDiary();

      expect(backend.dayReads).toContainEqual({ date: "2026-10-14", enabled: true });
    });

    it("should not read yesterday on a day that has foods", () => {
      showDay(TODAY);
      renderDiary();

      expect(backend.dayReads).not.toContainEqual({ date: "2026-10-14", enabled: true });
    });

    it("should copy the whole of yesterday onto the day", () => {
      renderDiary();

      fireEvent.click(screen.getByRole("button", { name: "Copy yesterday" }));

      expect(copyDay.mutate).toHaveBeenCalledOnce();
      expect(copyDay.mutate.mock.calls[0]?.[0]).toEqual({
        from: "2026-10-14",
        to: TODAY,
        timeZone: "UTC",
      });
    });

    it("should confirm the copy with the count and offer Undo", () => {
      const copied: CopiedDay = { localDate: TODAY, count: 8, entryIds: ["a", "b"] };
      copyDay.mutate.mockImplementation(
        (_input, options: { onSuccess: (c: CopiedDay) => void }) => {
          options.onSuccess(copied);
        },
      );
      renderDiary();

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Copy yesterday" }));
      });

      expect(screen.getByText("Copied 8 entries from yesterday")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      expect(undoCopyDay.mutate.mock.calls[0]?.[0]).toBe(copied);
    });

    it("should say when the copy failed", () => {
      copyDay.mutate.mockImplementation((_input, options) => {
        options.onError();
      });
      renderDiary();

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Copy yesterday" }));
      });

      expect(screen.getByRole("alert").textContent).toBe(
        "Not copied. Check your connection and try again.",
      );
    });

    it("should dim the button and say why when yesterday has nothing to copy", () => {
      showDay("2026-10-14", []);
      renderDiary();

      expect(screen.getByRole("button", { name: "Copy yesterday" })).toHaveProperty(
        "disabled",
        true,
      );
      expect(screen.getByText("Nothing logged yesterday")).toBeTruthy();
    });

    it("should have no card on a day with foods", () => {
      showDay(TODAY);
      renderDiary();

      expect(screen.queryByRole("region", { name: "Nothing logged yet" })).toBeNull();
    });
  });

  describe("over target", () => {
    it("should say which bars are over and keep the log as it is", () => {
      showDay(TODAY, overTargetDay());
      renderDiary();

      expect(strip().getAttribute("aria-label")).toBe(
        "Targets. Calories: 2,412 of 2,200 kilocalories, over target. Protein: 150 of 160 grams. Carbohydrate: 257 of 220 grams, over target. Fat: 81 of 70 grams, over target",
      );
      expect(screen.getByRole("group", { name: "19:00, 1 food" })).toBeTruthy();
    });
  });

  describe("with no target", () => {
    it("should show the values alone and still open Targets", () => {
      setTargets(noTargets);
      renderDiary();

      expect(strip().getAttribute("aria-label")).toBe(
        "Targets. Calories: 1,039 kilocalories. Protein: 86 grams. Carbohydrate: 129 grams. Fat: 19 grams",
      );
      fireEvent.click(strip());
      expect(push).toHaveBeenCalledExactlyOnceWith("/more/targets");
    });
  });

  describe("a quick add made with calories alone", () => {
    beforeEach(() => {
      showDay(TODAY, [quickEntry({ date: TODAY, time: "09:15", label: "Cake slice", kcal: 310 })]);
    });

    it("should write a dash in the table for the macros it has no value for", () => {
      renderDiary();

      const row = within(tableOf("09:00")).getByRole("row", { name: /Cake slice/ });

      expect(
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      ).toEqual(["Cake slice09:15 · Quick add", "–", "–", "–", "310 kcal", ""]);
    });

    it("should say the stacked row needs review", () => {
      renderDiary();
      const stacked = within(screen.getByRole("region", { name: "Foods at 09:00" })).getByRole(
        "list",
      );

      expect(within(stacked).getByText("Needs review")).toBeTruthy();
    });

    it("should still add the calories up in the bars", () => {
      renderDiary();

      expect(strip().getAttribute("aria-label")).toContain("Calories: 310 of 2,200 kilocalories");
    });
  });

  describe("loading", () => {
    it("should stand in for the whole body until the first day has loaded", () => {
      backend.days.clear();
      renderDiary();

      expect(screen.getByRole("heading", { level: 1, name: "Today" })).toBeTruthy();
      expect(screen.getByRole("status", { name: "Loading your diary" })).toBeTruthy();
      expect(screen.queryByRole("group", { name: /^Week|This week/ })).toBeNull();
    });

    it("should wait for the profile's time zone before reading a day", () => {
      backend.timeZone = waiting();
      renderDiary();

      expect(screen.getByRole("status", { name: "Loading your diary" })).toBeTruthy();
      expect(backend.dayReads).toEqual([]);
    });
  });

  describe("an error", () => {
    it("should say the diary could not load and offer to try again", () => {
      backend.days.set(TODAY, failed());
      renderDiary();

      expect(screen.getByRole("heading", { name: "Couldn't load your diary" })).toBeTruthy();
      expect(screen.getByText("Check your connection and try again.")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(refetch).toHaveBeenCalledOnce();
    });

    it("should keep the log on screen when a refetch fails and the day is already loaded", () => {
      backend.days.set(TODAY, { ...settled(diaryDay(TODAY, sampleDay())), isError: true });
      backend.targets = { ...settled(targets), isError: true };
      renderDiary();

      expect(screen.queryByRole("heading", { name: "Couldn't load your diary" })).toBeNull();
      expect(screen.getByRole("group", { name: "08:00, 3 foods" })).toBeTruthy();
    });

    it("should say so when the targets could not load either", () => {
      backend.targets = failed<Targets>();
      renderDiary();

      expect(screen.getByRole("heading", { name: "Couldn't load your diary" })).toBeTruthy();
    });

    it("should say so when the time zone could not load", () => {
      backend.timeZone = failed();
      renderDiary();

      expect(screen.getByRole("heading", { name: "Couldn't load your diary" })).toBeTruthy();
    });
  });
});
