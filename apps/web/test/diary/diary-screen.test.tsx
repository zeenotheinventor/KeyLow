import { CopyDayPartialWriteError } from "@keylow/api-client";
import { buildLogEntry } from "@keylow/core/diary";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { oliveOil } from "./portionFoods";
import {
  boardRecipeTotal,
  diaryDay,
  noTargets,
  overTargetDay,
  quickEntry,
  recipeEntry,
  sampleDay,
  targets,
} from "./support";

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
    mutateAsync: vi.fn<(entry: LogEntry) => Promise<void>>(),
    isPending: false,
  },
  restoreEntry: {
    mutateAsync: vi.fn<(entry: LogEntry) => Promise<void>>(),
    isPending: false,
  },
  copyDay: {
    mutate:
      vi.fn<
        (
          input: { from: string; to: string; timeZone: string },
          options: { onSuccess: (copied: CopiedDay) => void; onError: (error: Error) => void },
        ) => void
      >(),
    isPending: false,
  },
  undoCopyDay: {
    mutate: vi.fn<(copied: CopiedDay, options?: { onError: () => void }) => void>(),
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
  const tree = () => (
    <ToastProvider>
      <DiaryScreen date={props.date} view={props.view ?? "day"} />
    </ToastProvider>
  );
  const view = render(tree());

  // Draws the screen again with what the backend holds now, as it is when the diary has refetched.
  return {
    ...view,
    redraw: () => {
      view.rerender(tree());
    },
  };
}

// The entries the screen was given, as it was given them: their ids are what Edit hands over.
const entryOnShow = (index: number) => backend.days.get(TODAY)?.data?.entries[index];
const strip = () => screen.getByRole("button", { name: /^Targets\./ });
const tableOf = (hour: string) => screen.getByRole("table", { name: `Foods at ${hour}` });

beforeEach(() => {
  vi.resetAllMocks();
  deleteEntry.mutateAsync.mockResolvedValue();
  restoreEntry.mutateAsync.mockResolvedValue();
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
  onlineManager.setOnline(true);
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

    describe("an amount logged in spoons", () => {
      // The board's "2 tbsp (30 ml)" row: olive oil at 12:40, which the sample day has no entry of.
      function showDayWithOil() {
        const oil = buildLogEntry({
          food: oliveOil.food,
          quantity: 2,
          unit: "portion",
          portion: { id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: 15 },
          localDate: TODAY,
          loggedAt: `${TODAY}T12:40:00+00:00`,
        });
        showDay(TODAY, [
          ...sampleDay(TODAY),
          {
            ...oil,
            id: "00000000-0000-4000-8000-0000000000bb",
            created_at: "2026-10-15T12:40:30+00:00",
            kcal: oil.nutrients.kcal,
          },
        ]);
      }

      it("should read its count and its volume only, on the table row", () => {
        showDayWithOil();
        renderDiary();

        expect(
          within(within(tableOf("12:00")).getByRole("row", { name: /Oil, olive/ })).getByText(
            "12:40 · 2 tbsp (30 ml)",
          ),
        ).toBeTruthy();
      });

      it("should read the same on the stacked row", () => {
        showDayWithOil();
        renderDiary();

        const stacked = within(screen.getByRole("region", { name: "Foods at 12:00" })).getByRole(
          "list",
        );

        expect(within(stacked).getByRole("button", { name: /Oil, olive/ }).textContent).toContain(
          "12:40 · 2 tbsp (30 ml)",
        );
      });
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

  describe("a recipe entry in the day", () => {
    // The golden serving at 18:00 on the day of the boards: 374.2 kcal and 275 g.
    function showDayWithRecipe() {
      showDay(TODAY, [...sampleDay(TODAY), recipeEntry({ date: TODAY, time: "18:00" })]);
    }

    it("should list every entry of the day once, the recipe among them", () => {
      showDayWithRecipe();
      renderDiary();

      for (const name of [
        "Porridge oats",
        "Semi-skimmed milk",
        "Banana",
        "Chicken breast, grilled",
        "Basmati rice, boiled",
        "Meal deal crisps",
        "Greek yoghurt 0% fat",
        "Chicken and rice",
      ]) {
        expect(screen.getAllByRole("row", { name: new RegExp(name) })).toHaveLength(1);
      }
      expect(screen.getByRole("group", { name: "18:00, 1 food" })).toBeTruthy();
    });

    it("should write the recipe's name with the time and the serving it came to, on the table row", () => {
      showDayWithRecipe();
      renderDiary();

      const row = within(tableOf("18:00")).getByRole("row", { name: /Chicken and rice/ });

      expect(within(row).getByText("18:00 · 1 serving (275 g)")).toBeTruthy();
      expect(within(row).getByText("374")).toBeTruthy();
    });

    it("should write the same on the stacked row, as a button that opens the entry", () => {
      showDayWithRecipe();
      renderDiary();

      const stacked = within(screen.getByRole("region", { name: "Foods at 18:00" })).getByRole(
        "list",
      );

      expect(within(stacked).getByText("Chicken and rice")).toBeTruthy();
      expect(within(stacked).getByText("18:00 · 1 serving (275 g)")).toBeTruthy();
      expect(within(stacked).getByRole("button")).toBeTruthy();
    });

    it("should add the serving to the day's bars: 1,413 of 2,200 kcal", () => {
      showDayWithRecipe();
      renderDiary();

      expect(strip().getAttribute("aria-label")).toContain("Calories: 1,413 of 2,200 kilocalories");
    });

    it("should open the entry in the edit dialog from its Edit button and from the stacked row", () => {
      showDayWithRecipe();
      renderDiary();
      const recipe = entryOnShow(7);
      const table = within(tableOf("18:00"));
      const stacked = within(screen.getByRole("region", { name: "Foods at 18:00" })).getByRole(
        "list",
      );

      fireEvent.click(table.getByRole("button", { name: "Edit Chicken and rice" }));
      fireEvent.click(within(stacked).getByText("Chicken and rice"));

      expect(recipe?.item_type).toBe("recipe");
      expect(openEditEntry).toHaveBeenCalledTimes(2);
      expect(openEditEntry).toHaveBeenNthCalledWith(1, recipe?.id);
      expect(openEditEntry).toHaveBeenNthCalledWith(2, recipe?.id);
    });

    it("should still delete it from its Delete button, with the entry the diary holds", () => {
      showDayWithRecipe();
      renderDiary();
      const recipe = entryOnShow(7);

      fireEvent.click(
        within(tableOf("18:00")).getByRole("button", { name: "Delete Chicken and rice" }),
      );

      expect(recipe?.item_type).toBe("recipe");
      expect(deleteEntry.mutateAsync).toHaveBeenCalledExactlyOnceWith(recipe);
    });

    // The three amounts of the boards: by the serving, by grams, and by one and a half servings.
    it.each([
      {
        amount: { quantity: 1, unit: "serving" as const },
        caption: "18:00 · 1 serving (275 g)",
        cells: ["32 g", "43 g", "8.1 g", "374 kcal"],
        stats: ["374", "32 P", "43 C", "8.1 F"],
        name: "18:00, Chicken and rice, recipe, 1 serving 275 grams, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams",
      },
      {
        amount: { quantity: 300, unit: "g" as const },
        caption: "18:00 · 300 g",
        cells: ["35 g", "46 g", "8.9 g", "408 kcal"],
        stats: ["408", "35 P", "46 C", "8.9 F"],
        name: "18:00, Chicken and rice, recipe, 300 grams, 408 kilocalories, protein 35 grams, carbohydrate 46 grams, fat 8.9 grams",
      },
      {
        amount: { quantity: 1.5, unit: "serving" as const },
        caption: "18:00 · 1.5 servings (413 g)",
        cells: ["47 g", "64 g", "12 g", "561 kcal"],
        stats: ["561", "47 P", "64 C", "12 F"],
        name: "18:00, Chicken and rice, recipe, 1.5 servings 413 grams, 561 kilocalories, protein 47 grams, carbohydrate 64 grams, fat 12 grams",
      },
    ])(
      "should read $caption on both rows, named in words",
      ({ amount, caption, cells, stats, name }) => {
        showDay(TODAY, [
          ...sampleDay(TODAY),
          recipeEntry({ date: TODAY, time: "18:00", total: boardRecipeTotal, ...amount }),
        ]);
        renderDiary();

        const tableRow = within(tableOf("18:00")).getByRole("row", { name });
        const [nameCell, ...valueCells] = within(tableRow).getAllByRole("cell");
        const stacked = within(screen.getByRole("region", { name: "Foods at 18:00" })).getByRole(
          "listitem",
          { name },
        );

        expect(nameCell?.textContent).toBe(`Chicken and rice${caption}`);
        expect(valueCells.slice(0, 4).map((cell) => cell.textContent)).toEqual(cells);
        expect(within(stacked).getByText(caption)).toBeTruthy();
        for (const stat of stats) {
          expect(within(stacked).getByText(stat)).toBeTruthy();
        }
      },
    );

    it("should be the only row at 18:00 that carries the chef's hat", () => {
      showDayWithRecipe();
      renderDiary();

      expect(tableOf("18:00").querySelectorAll("svg.lucide-chef-hat")).toHaveLength(1);
      expect(tableOf("08:00").querySelector("svg.lucide-chef-hat")).toBeNull();
      expect(tableOf("12:00").querySelector("svg.lucide-chef-hat")).toBeNull();
    });

    it("should add the serving to every bar of the sample day: 1,413 kcal, P 118, C 172, F 27", () => {
      showDay(TODAY, [
        ...sampleDay(TODAY),
        recipeEntry({ date: TODAY, time: "18:00", total: boardRecipeTotal }),
      ]);
      renderDiary();

      expect(strip().getAttribute("aria-label")).toBe(
        "Targets. Calories: 1,413 of 2,200 kilocalories. Protein: 118 of 160 grams. Carbohydrate: 172 of 220 grams. Fat: 27 of 70 grams",
      );
    });

    it("should bring the recipe back with Undo after its Delete", async () => {
      showDayWithRecipe();
      renderDiary();
      const recipe = entryOnShow(7);

      fireEvent.click(
        within(tableOf("18:00")).getByRole("button", { name: "Delete Chicken and rice" }),
      );
      fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

      expect(restoreEntry.mutateAsync).toHaveBeenCalledExactlyOnceWith(recipe);
    });

    it("should look the same once Copy yesterday has copied it onto an empty day", () => {
      showDay(TODAY, []);
      showDay("2026-10-14", [
        recipeEntry({ date: "2026-10-14", time: "18:00", total: boardRecipeTotal }),
      ]);
      const view = renderDiary();
      const copied: CopiedDay = { localDate: TODAY, count: 1, entryIds: ["a"] };

      fireEvent.click(screen.getByRole("button", { name: "Copy yesterday" }));
      act(() => {
        showDay(TODAY, [recipeEntry({ date: TODAY, time: "18:00", total: boardRecipeTotal })]);
        copyDay.mutate.mock.calls[0]?.[1].onSuccess(copied);
      });
      act(() => {
        view.redraw();
      });

      const row = within(tableOf("18:00")).getByRole("row", {
        name: "18:00, Chicken and rice, recipe, 1 serving 275 grams, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams",
      });
      expect(within(row).getByText("18:00 · 1 serving (275 g)")).toBeTruthy();
      expect(row.querySelector("svg.lucide-chef-hat")).not.toBeNull();
      expect(within(row).getByRole("button", { name: "Edit Chicken and rice" })).toBeTruthy();
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

    it("should ask for the delete at once", () => {
      renderDiary();

      fireEvent.click(
        within(tableOf("08:00")).getByRole("button", { name: "Delete Porridge oats" }),
      );

      expect(deleteEntry.mutateAsync).toHaveBeenCalledOnce();
    });

    it("should say Entry deleted, with Undo, once the delete is saved and not before", async () => {
      let finishSaving: () => void = () => undefined;
      deleteEntry.mutateAsync.mockReturnValue(
        new Promise<void>((resolve) => {
          finishSaving = resolve;
        }),
      );
      renderDiary();

      fireEvent.click(
        within(tableOf("08:00")).getByRole("button", { name: "Delete Porridge oats" }),
      );

      expect(screen.queryByText("Entry deleted")).toBeNull();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();

      await act(async () => {
        finishSaving();
        await Promise.resolve();
      });

      expect(await screen.findByText("Entry deleted")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    });

    it("should bring the entry back with Undo", async () => {
      renderDiary();
      fireEvent.click(
        within(tableOf("08:00")).getByRole("button", { name: "Delete Porridge oats" }),
      );
      const deleted = deleteEntry.mutateAsync.mock.calls[0]?.[0];

      fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

      expect(restoreEntry.mutateAsync).toHaveBeenCalledOnce();
      expect(restoreEntry.mutateAsync.mock.calls[0]?.[0]).toBe(deleted);
    });

    describe("by keyboard", () => {
      const deletePorridge = () =>
        within(tableOf("08:00")).getByRole("button", { name: "Delete Porridge oats" });

      function pressDeleteWithKeyboard() {
        fireEvent.keyDown(document, { key: "Enter" });
        deletePorridge().focus();
        fireEvent.click(deletePorridge());
      }

      // The toast takes focus in an effect, a moment after it is drawn.
      async function findUndoHoldingFocus() {
        const undo = await screen.findByRole("button", { name: "Undo" });
        await waitFor(() => {
          expect(document.activeElement).toBe(undo);
        });

        return undo;
      }

      it("should move focus to Undo once the delete is saved", async () => {
        renderDiary();

        pressDeleteWithKeyboard();

        expect(await findUndoHoldingFocus()).toBe(document.activeElement);
      });

      it("should give focus to the next row when the toast is dismissed", async () => {
        renderDiary();
        pressDeleteWithKeyboard();

        fireEvent.keyDown(await findUndoHoldingFocus(), { key: "Escape" });

        expect(document.activeElement).toBe(
          within(tableOf("08:00")).getByRole("button", { name: "Edit Semi-skimmed milk" }),
        );
      });

      it("should give focus to the next row when Undo is pressed, and bring the entry back", async () => {
        renderDiary();
        pressDeleteWithKeyboard();

        fireEvent.click(await findUndoHoldingFocus());

        expect(restoreEntry.mutateAsync).toHaveBeenCalledOnce();
        expect(document.activeElement).toBe(
          within(tableOf("08:00")).getByRole("button", { name: "Edit Semi-skimmed milk" }),
        );
      });

      it("should announce the toast once", async () => {
        renderDiary();

        pressDeleteWithKeyboard();

        await screen.findByText("Entry deleted");
        expect(screen.getAllByText("Entry deleted")).toHaveLength(1);
        expect(screen.getAllByRole("status")).toHaveLength(1);
      });

      it("should leave focus alone after a pointer press", async () => {
        renderDiary();
        fireEvent.pointerDown(deletePorridge());
        deletePorridge().focus();

        fireEvent.click(deletePorridge(), { detail: 1 });

        await screen.findByText("Entry deleted");
        expect(document.activeElement).toBe(deletePorridge());
      });
    });

    it("should say so when a delete does not go through", async () => {
      deleteEntry.mutateAsync.mockRejectedValue(new Error("RAW"));
      renderDiary();

      fireEvent.click(
        within(tableOf("08:00")).getByRole("button", { name: "Delete Porridge oats" }),
      );

      expect(await screen.findByText("Something went wrong. Try again.")).toBeTruthy();
    });

    it("should say only that, never Entry deleted or Undo, when a delete does not go through", async () => {
      let failSaving: () => void = () => undefined;
      deleteEntry.mutateAsync.mockReturnValue(
        new Promise<void>((_resolve, reject) => {
          failSaving = () => {
            reject(new Error("RAW"));
          };
        }),
      );
      renderDiary();

      fireEvent.click(
        within(tableOf("08:00")).getByRole("button", { name: "Delete Porridge oats" }),
      );

      // While the save is on its way the entry is not yet deleted, so there is nothing to undo.
      expect(screen.queryByText("Entry deleted")).toBeNull();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();

      await act(async () => {
        failSaving();
        await Promise.resolve();
      });

      expect(await screen.findByText("Something went wrong. Try again.")).toBeTruthy();
      expect(screen.queryByText("Entry deleted")).toBeNull();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
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

    it("should confirm a single entry with its count too", () => {
      copyDay.mutate.mockImplementation((_input, options) => {
        options.onSuccess({ localDate: TODAY, count: 1, entryIds: ["a"] });
      });
      renderDiary();

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Copy yesterday" }));
      });

      expect(screen.getByText("Copied 1 entry from yesterday")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    });

    it("should show no toast and no Undo when yesterday had nothing to copy", () => {
      copyDay.mutate.mockImplementation((_input, options) => {
        options.onSuccess({ localDate: TODAY, count: 0, entryIds: [] });
      });
      renderDiary();

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Copy yesterday" }));
      });

      expect(screen.queryByText(/^Copied/)).toBeNull();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    });

    it("should say when the copy failed", () => {
      copyDay.mutate.mockImplementation((_input, options) => {
        options.onError(new Error("RAW"));
      });
      renderDiary();

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Copy yesterday" }));
      });

      expect(screen.getByRole("alert").textContent).toBe(
        "Not copied. Check your connection and try again.",
      );
    });

    it("should take nothing back when the copy fails with nothing written", () => {
      copyDay.mutate.mockImplementation((_input, options) => {
        options.onError(new Error("RAW"));
      });
      renderDiary();

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Copy yesterday" }));
      });

      expect(undoCopyDay.mutate).not.toHaveBeenCalled();
    });

    it("should take back the copies already written when the copy fails part way, and say it failed", () => {
      const partialWrite = new CopyDayPartialWriteError(
        ["a", "b"],
        "Copied 2 of 3",
        new Error("RAW"),
      );
      copyDay.mutate.mockImplementation((_input, options) => {
        options.onError(partialWrite);
      });
      renderDiary();

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Copy yesterday" }));
      });

      expect(undoCopyDay.mutate).toHaveBeenCalledOnce();
      expect(undoCopyDay.mutate).toHaveBeenCalledWith({
        localDate: TODAY,
        count: 2,
        entryIds: ["a", "b"],
      });
      expect(screen.getByRole("alert").textContent).toBe(
        "Not copied. Check your connection and try again.",
      );
    });

    describe("by keyboard", () => {
      const copied: CopiedDay = { localDate: TODAY, count: 8, entryIds: ["a"] };
      const copyYesterday = () => screen.getByRole("button", { name: "Copy yesterday" });
      const dayCompleteSwitch = () => screen.getByRole("switch", { name: /Mark day complete/ });
      const firstCopiedRow = () =>
        within(tableOf("08:00")).getByRole("button", { name: "Edit Porridge oats" });

      function pressWithKeyboard() {
        fireEvent.keyDown(document, { key: "Enter" });
        copyYesterday().focus();
        fireEvent.click(copyYesterday());
      }

      // The copy goes through. The day fills, and the empty day's card, with its button, goes.
      function finishCopy(view: { redraw: () => void }, { fillsDay = true } = {}) {
        act(() => {
          if (fillsDay) {
            showDay(TODAY, sampleDay(TODAY));
          }
          copyDay.mutate.mock.calls[0]?.[1].onSuccess(copied);
        });
        act(() => {
          view.redraw();
        });
      }

      it("should move focus to Undo", () => {
        const view = renderDiary();
        pressWithKeyboard();

        finishCopy(view);

        expect(screen.queryByRole("button", { name: "Copy yesterday" })).toBeNull();
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Undo" }));
      });

      it("should give focus to the first copied row when the toast is dismissed, never the page", () => {
        const view = renderDiary();
        pressWithKeyboard();
        finishCopy(view);

        fireEvent.keyDown(screen.getByRole("button", { name: "Undo" }), { key: "Escape" });

        expect(document.activeElement).toBe(firstCopiedRow());
        expect(document.activeElement).not.toBe(document.body);
      });

      it("should give focus to the day's complete switch when no row has been drawn", () => {
        const view = renderDiary();
        pressWithKeyboard();
        finishCopy(view, { fillsDay: false });

        fireEvent.keyDown(screen.getByRole("button", { name: "Undo" }), { key: "Escape" });

        expect(document.activeElement).toBe(dayCompleteSwitch());
      });

      it("should take the copy back with Undo and leave focus on the complete switch, which is still there", () => {
        const view = renderDiary();
        pressWithKeyboard();
        finishCopy(view);

        fireEvent.click(screen.getByRole("button", { name: "Undo" }));
        expect(undoCopyDay.mutate.mock.calls[0]?.[0]).toBe(copied);
        // The undo is answered, and the empty day's card comes back.
        act(() => {
          showDay(TODAY, []);
        });
        act(() => {
          view.redraw();
        });

        expect(screen.getByRole("button", { name: "Copy yesterday" })).toBeTruthy();
        expect(document.activeElement).toBe(dayCompleteSwitch());
      });

      it("should leave focus alone after a pointer press", () => {
        const view = renderDiary();
        fireEvent.pointerDown(copyYesterday());
        copyYesterday().focus();
        fireEvent.click(copyYesterday(), { detail: 1 });

        finishCopy(view);

        expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
        expect(document.activeElement).toBe(document.body);
      });

      it("should leave focus where the person put it when they moved on before the copy finished", () => {
        const view = renderDiary();
        pressWithKeyboard();
        const elsewhere = screen.getByRole("button", { name: "Choose a date" });
        act(() => {
          elsewhere.focus();
        });

        finishCopy(view);

        expect(document.activeElement).toBe(elsewhere);
      });
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

  describe("offline", () => {
    const goOffline = () => {
      act(() => {
        onlineManager.setOnline(false);
      });
    };
    const goOnline = () => {
      act(() => {
        onlineManager.setOnline(true);
      });
    };

    describe("the notice", () => {
      it("should say the diary is offline and that changes need a connection", () => {
        onlineManager.setOnline(false);
        renderDiary();

        // The toast region is a status too, so the notice is the one that holds its title.
        const notice = screen
          .getAllByRole("status")
          .find((status) => within(status).queryByText("You're offline") !== null);
        if (notice === undefined) {
          throw new Error("no offline notice");
        }
        expect(within(notice).getByText("You're offline")).toBeTruthy();
        expect(
          within(notice).getByText("Showing your last saved diary. Changes need a connection."),
        ).toBeTruthy();
      });

      it("should be absent online, appear when the connection drops and go when it returns", () => {
        renderDiary();
        expect(screen.queryByText("You're offline")).toBeNull();

        goOffline();
        expect(screen.getByText("You're offline")).toBeTruthy();

        goOnline();
        expect(screen.queryByText("You're offline")).toBeNull();
      });

      it("should sit above the bars, at the top of the day", () => {
        onlineManager.setOnline(false);
        renderDiary();

        const position = screen.getByText("You're offline").compareDocumentPosition(strip());
        expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      });
    });

    describe("the hour's plus", () => {
      it("should be disabled on every hour, and add nothing", () => {
        onlineManager.setOnline(false);
        renderDiary();

        const pluses = screen.getAllByRole("button", { name: /^Add food at / });
        expect(pluses).toHaveLength(24);
        for (const plus of pluses) {
          fireEvent.click(plus);
          expect(plus).toHaveProperty("disabled", true);
        }
        expect(openAddFood).not.toHaveBeenCalled();
      });

      it("should work again with no reload when the connection returns", () => {
        onlineManager.setOnline(false);
        renderDiary();

        goOnline();
        fireEvent.click(screen.getByRole("button", { name: "Add food at 12:00" }));

        expect(openAddFood).toHaveBeenCalledExactlyOnceWith({ date: TODAY, time: "12:00" });
      });
    });

    describe("a row's Delete", () => {
      it("should be disabled, and delete nothing", () => {
        onlineManager.setOnline(false);
        renderDiary();
        const remove = within(tableOf("08:00")).getByRole("button", {
          name: "Delete Porridge oats",
        });

        fireEvent.click(remove);

        expect(remove).toHaveProperty("disabled", true);
        expect(deleteEntry.mutateAsync).not.toHaveBeenCalled();
      });

      it("should delete again when the connection returns", () => {
        onlineManager.setOnline(false);
        renderDiary();

        goOnline();
        fireEvent.click(
          within(tableOf("08:00")).getByRole("button", { name: "Delete Porridge oats" }),
        );

        expect(deleteEntry.mutateAsync).toHaveBeenCalledOnce();
      });
    });

    describe("the complete switch", () => {
      it("should be disabled, and mark nothing", () => {
        onlineManager.setOnline(false);
        renderDiary();
        const toggle = screen.getByRole("switch", { name: /Mark day complete/ });

        fireEvent.click(toggle);

        expect(toggle).toHaveProperty("disabled", true);
        expect(setDayComplete.mutate).not.toHaveBeenCalled();
      });

      it("should work again when the connection returns", () => {
        onlineManager.setOnline(false);
        renderDiary();

        goOnline();
        fireEvent.click(screen.getByRole("switch", { name: /Mark day complete/ }));

        expect(setDayComplete.mutate).toHaveBeenCalledOnce();
      });
    });

    describe("Copy yesterday", () => {
      beforeEach(() => {
        showDay(TODAY, []);
        showDay("2026-10-14", sampleDay("2026-10-14"));
      });

      it("should be disabled, and copy nothing", () => {
        onlineManager.setOnline(false);
        renderDiary();
        const copy = screen.getByRole("button", { name: "Copy yesterday" });

        fireEvent.click(copy);

        expect(copy).toHaveProperty("disabled", true);
        expect(copyDay.mutate).not.toHaveBeenCalled();
      });

      it("should copy again when the connection returns", () => {
        onlineManager.setOnline(false);
        renderDiary();

        goOnline();
        fireEvent.click(screen.getByRole("button", { name: "Copy yesterday" }));

        expect(copyDay.mutate).toHaveBeenCalledOnce();
      });
    });

    describe("what stays on", () => {
      it("should leave opening a row, the date controls, the week strip and the view control alone", () => {
        onlineManager.setOnline(false);
        renderDiary();

        fireEvent.click(
          within(tableOf("08:00")).getByRole("button", { name: "Edit Porridge oats" }),
        );
        expect(openEditEntry).toHaveBeenCalledOnce();
        for (const control of [
          screen.getByRole("button", { name: "Choose a date" }),
          screen.getByRole("button", { name: "Monday 12 October, complete" }),
          screen.getByRole("radio", { name: "Week" }),
          strip(),
        ]) {
          expect(control).toHaveProperty("disabled", false);
        }
      });
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
