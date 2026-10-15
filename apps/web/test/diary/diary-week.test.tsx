import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { diaryDay, targets } from "./support";

import type { CopiedDay, DayTotals, DiaryDay, DiaryWeekDay, Targets } from "@keylow/api-client";
import type { NextRouter } from "next/router";

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
  targets: Query<Targets>;
  weeks: Map<string, Query<DiaryWeekDay[]>>;
  completeDays: Query<string[]>;
  weekReads: string[];
  dayReads: { date: string; enabled: boolean | undefined }[];
};

const backend = vi.hoisted((): Backend => ({
  timeZone: { data: undefined, isError: false, isSuccess: false, refetch: () => Promise.resolve() },
  targets: { data: undefined, isError: false, isSuccess: false, refetch: () => Promise.resolve() },
  weeks: new Map(),
  completeDays: {
    data: undefined,
    isError: false,
    isSuccess: false,
    refetch: () => Promise.resolve(),
  },
  weekReads: [],
  dayReads: [],
}));

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

const { push, copyDay, undoCopyDay } = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
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
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@/lib/foodLogActions", () => ({
  useFoodLogActions: () => ({
    openAddFood: vi.fn(),
    openEditEntry: vi.fn(),
    setViewedDate: vi.fn(),
    viewedDate: undefined,
  }),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => backend.timeZone,
  useDiaryDay: (date: string, options?: { enabled?: boolean }) => {
    backend.dayReads.push({ date, enabled: options?.enabled });
    return settled<DiaryDay>(diaryDay(date, []));
  },
  useDiaryWeek: (weekStart: string, options?: { enabled?: boolean }) => {
    // The screen's own strip does not read the week while the week view is on.
    if (options?.enabled !== false) {
      backend.weekReads.push(weekStart);
    }
    return backend.weeks.get(weekStart) ?? waiting();
  },
  useTargets: () => backend.targets,
  useCompleteDays: () => backend.completeDays,
  useCopyDay: () => copyDay,
  useUndoCopyDay: () => undoCopyDay,
}));

const TODAY = "2026-10-15";

function totalsOf(
  localDate: string,
  [kcal, protein, carbs, fat]: [number, number, number, number],
): DayTotals {
  return {
    local_date: localDate,
    entry_count: 5,
    kcal,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    fibre_g: null,
    sat_fat_g: null,
    sugars_g: null,
    salt_g: null,
  };
}

function weekDay(
  localDate: string,
  totals: [number, number, number, number] | null,
  isComplete = false,
): DiaryWeekDay {
  return {
    localDate,
    totals: totals === null ? null : totalsOf(localDate, totals),
    dayLog: isComplete
      ? { local_date: localDate, is_complete: true, completed_at: null, note: null }
      : null,
  };
}

// The week on the web diary board: Monday 12 to Sunday 18 October 2026, today Thursday the 15th.
const boardWeek = [
  weekDay("2026-10-12", [2140, 158, 214, 66], true),
  weekDay("2026-10-13", [2260, 149, 231, 74], true),
  weekDay("2026-10-14", [1286, 111, 129, 35]),
  weekDay("2026-10-15", [1039, 86, 129, 19]),
  weekDay("2026-10-16", null),
  weekDay("2026-10-17", null),
  weekDay("2026-10-18", null),
];

// The week before it, Monday 5 to Sunday 11 October, every day past.
const earlierWeek = [5, 6, 7, 8, 9, 10, 11].map((day) =>
  weekDay(`2026-10-${String(day).padStart(2, "0")}`, [1800, 120, 200, 60]),
);

function renderWeek(props: { date?: string | undefined } = {}) {
  const router = {
    push: vi.fn().mockResolvedValue(true),
    replace: vi.fn().mockResolvedValue(true),
    prefetch: vi.fn().mockResolvedValue(undefined),
  } as unknown as NextRouter;

  return render(
    <RouterContext.Provider value={router}>
      <ToastProvider>
        <DiaryScreen date={props.date} view="week" />
      </ToastProvider>
    </RouterContext.Provider>,
  );
}

const cellOf = (name: string) => screen.getByRole("listitem", { name });
const copyButton = (day: string) => screen.getByRole("button", { name: `Copy to today, ${day}` });

beforeEach(() => {
  vi.resetAllMocks();
  // 11:20 on Thursday 15 October 2026.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T11:20:00Z"));
  backend.timeZone = settled("UTC");
  backend.targets = settled(targets);
  backend.weeks.clear();
  backend.weeks.set("2026-10-12", settled(boardWeek));
  backend.weeks.set("2026-10-05", settled(earlierWeek));
  backend.completeDays = settled([]);
  backend.weekReads = [];
  backend.dayReads = [];
  copyDay.isPending = false;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the week view", () => {
  describe("the header", () => {
    it("should be a day stepper and the Day and Week control, with Week chosen", () => {
      renderWeek();

      expect(screen.getByRole("button", { name: "Previous day" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Next day" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Today, 15 October. Choose a date" })).toBeTruthy();
      expect(screen.getByRole("radio", { name: "Week" })).toHaveProperty("checked", true);
    });

    it("should leave the day view's heading and calendar button out", () => {
      renderWeek();

      expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
      expect(screen.getAllByRole("button", { name: "Choose a date" })).toHaveLength(1);
    });

    it("should name the week by its Monday", () => {
      renderWeek();

      expect(screen.getByRole("heading", { name: "Week of Mon 12 Oct" })).toBeTruthy();
    });

    it("should step to the day before, staying in the week view", () => {
      renderWeek();

      fireEvent.click(screen.getByRole("button", { name: "Previous day" }));

      expect(push).toHaveBeenCalledExactlyOnceWith("/diary?date=2026-10-14&view=week");
    });

    it("should not step past today", () => {
      renderWeek();

      expect(screen.getByRole("button", { name: "Next day" })).toHaveProperty("disabled", true);
    });

    it("should show the week of the day on view, and read that week", () => {
      renderWeek({ date: "2026-10-08" });

      expect(screen.getByRole("heading", { name: "Week of Mon 5 Oct" })).toBeTruthy();
      expect(backend.weekReads).toContain("2026-10-05");
    });

    it("should not read the day, which the week view does not show", () => {
      renderWeek();

      expect(backend.dayReads.every((read) => read.enabled === false)).toBe(true);
    });

    it("should come back to the day view on Day, at the day on view", () => {
      renderWeek({ date: "2026-10-14" });

      fireEvent.click(screen.getByRole("radio", { name: "Day" }));

      expect(push).toHaveBeenCalledExactlyOnceWith("/diary?date=2026-10-14");
    });
  });

  describe("the date picker", () => {
    const openPicker = () => fireEvent.click(screen.getByRole("button", { name: "Choose a date" }));

    it("should open from the stepper's calendar button and say so", () => {
      renderWeek();

      openPicker();

      expect(screen.getByRole("dialog", { name: "Choose a date" })).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Choose a date" }).getAttribute("aria-expanded"),
      ).toBe("true");
    });

    it("should go to the day chosen, staying in the week view", () => {
      renderWeek();
      openPicker();

      fireEvent.click(
        within(screen.getByRole("dialog", { name: "Choose a date" })).getByRole("button", {
          name: "9 October",
        }),
      );

      expect(push).toHaveBeenCalledExactlyOnceWith("/diary?date=2026-10-09&view=week");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should close on the calendar button pressed again", () => {
      renderWeek();
      openPicker();

      openPicker();

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should give focus back to the calendar button on Escape", () => {
      renderWeek();
      openPicker();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Choose a date" }));
    });
  });

  describe("the grid", () => {
    it("should draw the seven days and the average", () => {
      renderWeek();

      const list = screen.getByRole("list", { name: "Week of Mon 12 Oct" });

      expect(within(list).getAllByRole("listitem")).toHaveLength(8);
      expect(within(cellOf("Mon 12")).getByText("2,140")).toBeTruthy();
      expect(within(cellOf("Mon 12")).getByText("P 158 · C 214 · F 66 g")).toBeTruthy();
      expect(within(cellOf("Average")).getByText("1,681")).toBeTruthy();
    });

    it("should mark a day complete as the day's own toggle does", () => {
      renderWeek();

      expect(within(cellOf("Tue 13")).getByText("Complete")).toBeTruthy();
      expect(within(cellOf("Wed 14")).getByText("Incomplete")).toBeTruthy();
    });

    it("should draw the bars against the calorie target, and the over target day full", () => {
      renderWeek();

      expect(
        within(cellOf("Tue 13"))
          .getByRole("meter", { name: "Tue 13 calories" })
          .getAttribute("aria-valuetext"),
      ).toBe("2,260 of 2,200 kilocalories, over target");
    });

    it("should draw no bars when there is no calorie target", () => {
      backend.targets = settled({ kcal: null, protein_g: null, carbs_g: null, fat_g: null });
      renderWeek();

      expect(screen.queryAllByRole("meter")).toHaveLength(0);
      expect(within(cellOf("Mon 12")).getByText("2,140")).toBeTruthy();
    });

    it("should open a day in the day view from its date, and today at the bare address", () => {
      renderWeek();

      expect(screen.getByRole("link", { name: "Tue 13" }).getAttribute("href")).toBe(
        "/diary?date=2026-10-13",
      );
      expect(screen.getByRole("link", { name: "Thu 15" }).getAttribute("href")).toBe("/diary");
    });

    it("should count a nutrient no entry gave a value for as zero", () => {
      const noMacros = weekDay("2026-10-12", [900, 0, 0, 0]);
      backend.weeks.set(
        "2026-10-12",
        settled([
          {
            ...noMacros,
            totals: noMacros.totals && {
              ...noMacros.totals,
              protein_g: null,
              carbs_g: null,
              fat_g: null,
            },
          },
          ...boardWeek.slice(1),
        ]),
      );
      renderWeek();

      expect(within(cellOf("Mon 12")).getByText("P 0 · C 0 · F 0 g")).toBeTruthy();
    });
  });

  describe("Copy to today", () => {
    it("should be on each past day that has entries, and nowhere else", () => {
      renderWeek();

      expect(screen.getAllByRole("button", { name: /^Copy to today/ })).toHaveLength(3);
      expect(within(cellOf("Thu 15")).queryByRole("button")).toBeNull();
      expect(within(cellOf("Fri 16")).queryByRole("button")).toBeNull();
    });

    it("should copy the whole day into today, in the profile's time zone", () => {
      renderWeek();

      fireEvent.click(copyButton("Tue 13"));

      expect(copyDay.mutate).toHaveBeenCalledOnce();
      expect(copyDay.mutate.mock.calls[0]?.[0]).toEqual({
        from: "2026-10-13",
        to: TODAY,
        timeZone: "UTC",
      });
    });

    it("should confirm with the count and offer Undo", () => {
      renderWeek();
      fireEvent.click(copyButton("Tue 13"));

      act(() => {
        copyDay.mutate.mock.calls[0]?.[1].onSuccess({
          localDate: TODAY,
          count: 8,
          entryIds: ["a", "b"],
        });
      });

      expect(screen.getByText("Copied 8 entries to today")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    });

    it("should say 1 entry for a single entry", () => {
      renderWeek();
      fireEvent.click(copyButton("Tue 13"));

      act(() => {
        copyDay.mutate.mock.calls[0]?.[1].onSuccess({
          localDate: TODAY,
          count: 1,
          entryIds: ["a"],
        });
      });

      expect(screen.getByText("Copied 1 entry to today")).toBeTruthy();
    });

    it("should take the copy back with Undo, by the rows it made", () => {
      renderWeek();
      fireEvent.click(copyButton("Tue 13"));
      const copied = { localDate: TODAY, count: 8, entryIds: ["a", "b"] };
      act(() => {
        copyDay.mutate.mock.calls[0]?.[1].onSuccess(copied);
      });

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      expect(undoCopyDay.mutate).toHaveBeenCalledOnce();
      expect(undoCopyDay.mutate.mock.calls[0]?.[0]).toBe(copied);
    });

    it("should say so when a copy does not go through", () => {
      renderWeek();
      fireEvent.click(copyButton("Tue 13"));

      act(() => {
        copyDay.mutate.mock.calls[0]?.[1].onError();
      });

      expect(screen.getByText("Something went wrong. Try again.")).toBeTruthy();
    });

    it("should say so when an Undo does not go through", () => {
      renderWeek();
      fireEvent.click(copyButton("Tue 13"));
      act(() => {
        copyDay.mutate.mock.calls[0]?.[1].onSuccess({
          localDate: TODAY,
          count: 8,
          entryIds: ["a"],
        });
      });
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      act(() => {
        undoCopyDay.mutate.mock.calls[0]?.[1].onError();
      });

      expect(screen.getByText("Something went wrong. Try again.")).toBeTruthy();
    });

    it("should wait while a copy is on its way", () => {
      copyDay.isPending = true;
      renderWeek();

      for (const button of screen.getAllByRole("button", { name: /^Copy to today/ })) {
        expect(button).toHaveProperty("disabled", true);
      }
    });

    describe("by keyboard", () => {
      function copyWithKeyboard() {
        fireEvent.keyDown(document, { key: "Enter" });
        copyButton("Tue 13").focus();
        fireEvent.click(copyButton("Tue 13"));
        act(() => {
          copyDay.mutate.mock.calls[0]?.[1].onSuccess({
            localDate: TODAY,
            count: 8,
            entryIds: ["a"],
          });
        });
      }

      it("should move focus to Undo", () => {
        renderWeek();

        copyWithKeyboard();

        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Undo" }));
      });

      it("should give focus back to the Copy to today that was pressed when the toast is dismissed", () => {
        renderWeek();
        copyWithKeyboard();

        fireEvent.keyDown(screen.getByRole("button", { name: "Undo" }), { key: "Escape" });

        expect(document.activeElement).toBe(copyButton("Tue 13"));
      });

      it("should give focus back to it when Undo is pressed, and take the copy back", () => {
        renderWeek();
        copyWithKeyboard();

        fireEvent.click(screen.getByRole("button", { name: "Undo" }));

        expect(undoCopyDay.mutate).toHaveBeenCalledOnce();
        expect(document.activeElement).toBe(copyButton("Tue 13"));
      });

      it("should announce the toast once", () => {
        renderWeek();

        copyWithKeyboard();

        expect(screen.getAllByText("Copied 8 entries to today")).toHaveLength(1);
        expect(screen.getAllByRole("status")).toHaveLength(1);
      });

      it("should leave focus alone after a pointer press", () => {
        renderWeek();
        fireEvent.pointerDown(copyButton("Tue 13"));
        copyButton("Tue 13").focus();
        fireEvent.click(copyButton("Tue 13"));

        act(() => {
          copyDay.mutate.mock.calls[0]?.[1].onSuccess({
            localDate: TODAY,
            count: 8,
            entryIds: ["a"],
          });
        });

        expect(document.activeElement).toBe(copyButton("Tue 13"));
      });
    });
  });

  describe("a week that is over", () => {
    it("should offer Copy to today on every day with entries", () => {
      renderWeek({ date: "2026-10-08" });

      expect(screen.getAllByRole("button", { name: /^Copy to today/ })).toHaveLength(7);
    });

    it("should average all seven days", () => {
      renderWeek({ date: "2026-10-08" });

      expect(within(cellOf("Average")).getByText("1,800")).toBeTruthy();
    });
  });

  describe("loading", () => {
    it("should stand in for the week until it loads", () => {
      backend.weeks.set("2026-10-12", waiting());
      renderWeek();

      expect(screen.getByRole("status", { name: "Loading your diary" })).toBeTruthy();
      expect(screen.queryByRole("list", { name: /^Week of/ })).toBeNull();
    });

    it("should stand in for the week until the targets load", () => {
      backend.targets = waiting();
      renderWeek();

      expect(screen.getByRole("status", { name: "Loading your diary" })).toBeTruthy();
    });

    it("should keep the stepper and the control on screen while the week loads", () => {
      backend.weeks.set("2026-10-12", waiting());
      renderWeek();

      expect(screen.getByRole("button", { name: "Previous day" })).toBeTruthy();
      expect(screen.getByRole("radio", { name: "Day" })).toBeTruthy();
    });
  });

  describe("an error", () => {
    it("should say the diary could not load and offer to try again", () => {
      backend.weeks.set("2026-10-12", failed());
      renderWeek();

      expect(screen.getByRole("heading", { name: "Couldn't load your diary" })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(refetch).toHaveBeenCalledOnce();
    });

    it("should keep the week on screen when a refresh fails after it has loaded", () => {
      backend.weeks.set("2026-10-12", { ...settled(boardWeek), isError: true });
      renderWeek();

      expect(screen.getByRole("list", { name: "Week of Mon 12 Oct" })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Couldn't load your diary" })).toBeNull();
    });
  });
});
