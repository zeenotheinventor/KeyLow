import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { diaryDay, entryLoggedFrom, foodEntry, quickEntry, recipeEntry } from "./support";
import { makeFood, makePortion } from "../foods/support";

import type { DiaryDay, EntryUpdate, LogEntry } from "@keylow/api-client";
import type { Food, FoodPortion } from "@keylow/core/schemas";

import { EditEntryDialog } from "@/components/diary/EditEntryDialog";
import { ToastProvider } from "@/components/ui/Toast";

type Api = {
  timeZone: string;
  entries: LogEntry[];
  food: Food | null | undefined;
  portions: FoodPortion[] | undefined;
  updateEntry: {
    mutateAsync: ReturnType<typeof vi.fn<(update: EntryUpdate) => Promise<LogEntry>>>;
  };
  deleteEntry: { mutateAsync: ReturnType<typeof vi.fn<(entry: LogEntry) => Promise<void>>> };
  restoreEntry: { mutateAsync: ReturnType<typeof vi.fn<(entry: LogEntry) => Promise<void>>> };
};

const api = vi.hoisted((): Api => ({
  timeZone: "UTC",
  entries: [],
  food: undefined,
  portions: [],
  updateEntry: { mutateAsync: undefined as never },
  deleteEntry: { mutateAsync: undefined as never },
  restoreEntry: { mutateAsync: undefined as never },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: api.timeZone }),
  useDiaryDay: (date: string): { data: DiaryDay } => ({ data: diaryDay(date, api.entries) }),
  useFood: () => ({ data: api.food }),
  useFoodPortions: () => ({ data: api.portions }),
  useUpdateEntry: () => api.updateEntry,
  useDeleteEntry: () => api.deleteEntry,
  useRestoreEntry: () => api.restoreEntry,
}));

const TODAY = "2026-10-15";

// The food the entries below were logged from, as the support builds it: 100 kcal per 100 g.
const chickenName = "Chicken breast, grilled";
const loggedFood = (): Food =>
  makeFood({
    id: "22222222-2222-4222-8222-222222222222",
    name: chickenName,
    kcal: 100,
    protein_g: 10,
    fat_g: 5,
    carbs_g: 20,
    fibre_g: null,
    quality: {},
    owner_id: null,
  });

const chickenOptions = {
  date: TODAY,
  time: "12:40",
  name: chickenName,
  quantity: 150,
  unit: "g",
  kcal: 150,
  protein: 15,
  fat: 7.5,
  carbs: 30,
} as const;

const chickenEntry = (): LogEntry => foodEntry(chickenOptions);

function renderDialog(entry: LogEntry) {
  api.entries = [entry];
  const onClose = vi.fn<() => void>();
  const dialogTree = () => (
    <ToastProvider>
      <EditEntryDialog entryId={entry.id} date={TODAY} opener={null} onClose={onClose} />
    </ToastProvider>
  );
  const { rerender } = render(dialogTree());

  // The diary query refreshing after a write: the dialog reads the day again.
  const refreshDiary = () => {
    rerender(dialogTree());
  };

  return { onClose, refreshDiary };
}

function chooseTime(hour: string) {
  fireEvent.click(screen.getByRole("button", { name: "Time 12:40" }));
  fireEvent.click(
    within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: hour }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
}

const dialog = () => screen.getByRole("dialog", { name: "Edit entry" });
const amount = () => screen.getByRole("textbox", { name: /^Amount/ });

beforeEach(() => {
  api.timeZone = "UTC";
  api.food = loggedFood();
  api.portions = [];
  api.updateEntry.mutateAsync = vi.fn((update: EntryUpdate) => Promise.resolve(update.entry));
  api.deleteEntry.mutateAsync = vi.fn(() => Promise.resolve());
  api.restoreEntry.mutateAsync = vi.fn(() => Promise.resolve());
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("the edit entry dialog for a recipe entry", () => {
  it("should draw nothing and close at once, since a recipe entry has no edit dialog yet", async () => {
    const { onClose } = renderDialog(recipeEntry({ date: TODAY, time: "18:00" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
  });
});

describe("the edit entry dialog for a logged food", () => {
  describe("what it shows", () => {
    it("should be titled Edit entry, with the food's name and the logged amount in the hero", () => {
      renderDialog(chickenEntry());

      const hero = screen.getByRole("group", { name: "Energy and macros, For 150 g" });
      expect(dialog()).toBeTruthy();
      expect(within(hero).getByText(chickenName)).toBeTruthy();
      expect(within(hero).getByText("150")).toBeTruthy();
    });

    it("should show the logged amount and its unit", () => {
      renderDialog(chickenEntry());

      expect(amount()).toHaveProperty("value", "150");
      expect(screen.getByRole("radio", { name: "g", checked: true })).toBeTruthy();
    });

    it("should show the entry's own time in the Time field, with no Now under it", () => {
      renderDialog(chickenEntry());

      expect(screen.getByRole("button", { name: "Time 12:40" })).toBeTruthy();
      expect(screen.queryByText("Now")).toBeNull();
    });

    it("should read the time in the profile's zone", () => {
      api.timeZone = "Europe/London";
      renderDialog(chickenEntry());

      // 12:40 UTC on 15 October is 13:40 in London, which is on summer time.
      expect(screen.getByRole("button", { name: "Time 13:40" })).toBeTruthy();
    });

    it("should have a leading Delete, then Cancel and Save", () => {
      renderDialog(chickenEntry());
      const buttons = within(dialog())
        .getAllByRole("button")
        .map((button) => button.textContent);

      expect(buttons.slice(-3)).toEqual(["Delete", "Cancel", "Save"]);
    });

    it("should offer no meal anywhere", () => {
      renderDialog(chickenEntry());

      expect(screen.queryByText(/breakfast|lunch|dinner|snack|meal/i)).toBeNull();
    });
  });

  describe("changing the amount", () => {
    it("should work the hero out again from the entry's own snapshot", () => {
      renderDialog(chickenEntry());

      fireEvent.change(amount(), { target: { value: "200" } });

      const hero = screen.getByRole("group", { name: "Energy and macros, For 200 g" });
      expect(within(hero).getByText("200")).toBeTruthy();
    });

    it("should save the new amount from the snapshot, and nothing else, then close", async () => {
      const entry = chickenEntry();
      const { onClose } = renderDialog(entry);
      fireEvent.change(amount(), { target: { value: "200" } });

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledExactlyOnceWith({
        entry,
        amount: { quantity: 200, unit: "g" },
      });
    });

    it("should not allow Save for an amount that is not above 0", () => {
      renderDialog(chickenEntry());

      fireEvent.change(amount(), { target: { value: "0" } });

      expect(screen.getByText("Enter an amount above 0.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);
    });
  });

  describe("changing the time", () => {
    it("should save the new time on the entry's own day, in the profile's zone, and no amount", async () => {
      const entry = chickenEntry();
      const { onClose } = renderDialog(entry);
      chooseTime("08");

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledExactlyOnceWith({
        entry,
        time: { loggedAt: "2026-10-15T08:40:00.000Z", timeZone: "UTC" },
      });
    });

    it("should save the time in the profile's zone", async () => {
      api.timeZone = "Europe/London";
      const entry = chickenEntry();
      renderDialog(entry);
      fireEvent.click(screen.getByRole("button", { name: "Time 13:40" }));
      fireEvent.click(
        within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "08" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      // 08:40 in London on 15 October is 07:40 UTC.
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledWith({
        entry,
        time: { loggedAt: "2026-10-15T07:40:00.000Z", timeZone: "Europe/London" },
      });
    });

    it("should save the amount and the time together in one request", async () => {
      const entry = chickenEntry();
      renderDialog(entry);
      fireEvent.change(amount(), { target: { value: "180" } });
      chooseTime("09");

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledWith({
        entry,
        amount: { quantity: 180, unit: "g" },
        time: { loggedAt: "2026-10-15T09:40:00.000Z", timeZone: "UTC" },
      });
    });

    it("should send no meal field with the save", async () => {
      renderDialog(chickenEntry());
      chooseTime("08");

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(Object.keys(api.updateEntry.mutateAsync.mock.calls[0]?.[0] ?? {}).sort()).toEqual([
        "entry",
        "time",
      ]);
    });
  });

  describe("saving", () => {
    it("should close without a request when nothing has changed", async () => {
      const { onClose } = renderDialog(chickenEntry());

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
    });

    it("should stay open with a banner, never the raw failure, when the save fails", async () => {
      api.updateEntry.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW 200 g failure")));
      const { onClose } = renderDialog(chickenEntry());
      fireEvent.change(amount(), { target: { value: "200" } });

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(
        await screen.findByText("Not saved. Check your connection and try again."),
      ).toBeTruthy();
      expect(screen.queryByText(/RAW/)).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      expect(amount()).toHaveProperty("value", "200");
    });

    it("should close on Cancel and Escape without saving", () => {
      const { onClose } = renderDialog(chickenEntry());
      fireEvent.change(amount(), { target: { value: "200" } });

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(2);
      expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
    });
  });

  describe("when the food has changed since it was logged", () => {
    beforeEach(() => {
      api.food = { ...loggedFood(), kcal: 120 };
    });

    it("should say so, and offer to update to the current food data", () => {
      renderDialog(chickenEntry());

      expect(screen.getByText("This food has changed since you logged it.")).toBeTruthy();
      expect(screen.getByText("Your entry keeps the values you saved.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Update to current food data" })).toBeTruthy();
    });

    it("should keep the entry's own values in the hero, not the food's", () => {
      renderDialog(chickenEntry());

      expect(
        within(screen.getByRole("group", { name: "Energy and macros, For 150 g" })).getByText(
          "150",
        ),
      ).toBeTruthy();
    });

    it("should leave the entry as it is on Save: only the update changes it", async () => {
      const { onClose } = renderDialog(chickenEntry());

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
    });

    it("should rebuild the entry from the current food, and only that, on the update", async () => {
      const entry = chickenEntry();
      const { onClose } = renderDialog(entry);

      fireEvent.click(screen.getByRole("button", { name: "Update to current food data" }));

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledWith({ entry, useCurrentFoodData: true });
      expect(onClose).not.toHaveBeenCalled();
    });

    it("should say it was not saved when the update fails", async () => {
      api.updateEntry.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW")));
      renderDialog(chickenEntry());

      fireEvent.click(screen.getByRole("button", { name: "Update to current food data" }));

      expect(
        await screen.findByText("Not saved. Check your connection and try again."),
      ).toBeTruthy();
    });

    it("should show the updated entry's own amount, not what was typed before the update", async () => {
      const entry = chickenEntry();
      const { refreshDiary } = renderDialog(entry);
      api.updateEntry.mutateAsync = vi.fn((update: EntryUpdate) => {
        api.entries = [{ ...foodEntry({ ...chickenOptions, quantity: 200 }), id: entry.id }];

        return Promise.resolve(update.entry);
      });

      fireEvent.change(amount(), { target: { value: "3" } });
      await act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Update to current food data" }));

        return Promise.resolve();
      });
      refreshDiary();

      expect(amount()).toHaveProperty("value", "200");
    });

    it("should keep a time changed before the update, as the update replaces only the amount", async () => {
      const entry = chickenEntry();
      const { refreshDiary } = renderDialog(entry);
      api.updateEntry.mutateAsync = vi.fn((update: EntryUpdate) => {
        api.entries = [{ ...foodEntry({ ...chickenOptions, quantity: 200 }), id: entry.id }];

        return Promise.resolve(update.entry);
      });

      chooseTime("08");
      fireEvent.change(amount(), { target: { value: "3" } });
      await act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Update to current food data" }));

        return Promise.resolve();
      });
      refreshDiary();

      expect(amount()).toHaveProperty("value", "200");
      expect(screen.getByRole("button", { name: "Time 08:40" })).toBeTruthy();
    });

    it("should keep what was typed when the update fails", async () => {
      api.updateEntry.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW")));
      renderDialog(chickenEntry());

      fireEvent.change(amount(), { target: { value: "3" } });
      fireEvent.click(screen.getByRole("button", { name: "Update to current food data" }));
      await screen.findByText("Not saved. Check your connection and try again.");

      expect(amount()).toHaveProperty("value", "3");
    });
  });

  it("should offer no update while the food is as it was logged", () => {
    renderDialog(chickenEntry());

    expect(screen.queryByText("This food has changed since you logged it.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Update to current food data" })).toBeNull();
  });

  describe("a food whose serving label gives a density", () => {
    const ketchup = makeFood({ id: "55555555-5555-4555-8555-555555555555", name: "Ketchup" });
    const servingOf = (label: string, grams: number): FoodPortion[] => [
      makePortion({ food_id: ketchup.id, label, grams, is_default: true }),
    ];
    const bannerText = "This food has changed since you logged it.";
    const loggedWithLabel = () =>
      entryLoggedFrom({
        food: ketchup,
        foodPortions: servingOf("1 tbsp (15 g)", 15),
        quantity: 30,
        unit: "g",
        date: TODAY,
        time: "12:40",
      });

    beforeEach(() => {
      api.food = ketchup;
    });

    it("should not call the food changed when the entry froze the density of the serving it still has", () => {
      api.portions = servingOf("1 tbsp (15 g)", 15);
      renderDialog(loggedWithLabel());

      expect(screen.queryByText(bannerText)).toBeNull();
    });

    it("should call the food changed once the serving it froze has changed", () => {
      api.portions = servingOf("1 tbsp (20 g)", 20);
      renderDialog(loggedWithLabel());

      expect(screen.getByText(bannerText)).toBeTruthy();
    });

    it("should say nothing about a change until the food's portions have loaded", () => {
      api.portions = undefined;
      renderDialog(loggedWithLabel());

      expect(screen.queryByText(bannerText)).toBeNull();
    });
  });

  describe("an entry that froze no density, on a drink that now has a serving label", () => {
    it("should show in the hero what saving stores, not a weight read from the label", () => {
      const drink = makeFood({
        id: "66666666-6666-4666-8666-666666666666",
        name: "Cola",
        basis: "per_100ml",
        kcal: 300,
      });
      api.food = drink;
      api.portions = [
        makePortion({ food_id: drink.id, label: "100 ml (103 g)", ml: 100, grams: null }),
      ];
      renderDialog(
        entryLoggedFrom({ food: drink, quantity: 100, unit: "ml", date: TODAY, time: "12:40" }),
      );

      fireEvent.click(screen.getByRole("radio", { name: "g" }));
      fireEvent.change(amount(), { target: { value: "100" } });

      // The snapshot froze no density, so 100 g is read as 100 ml, which is what saving stores (300 kcal).
      const hero = screen.getByRole("group", { name: "Energy and macros, For 100 g" });
      expect(within(hero).getByText("300")).toBeTruthy();
    });
  });

  describe("when the food has been deleted", () => {
    it("should say the entry keeps its saved values, with no update, and still allow Save", async () => {
      api.food = { ...loggedFood(), kcal: 120, deleted_at: "2026-10-14T08:00:00+00:00" };
      const { onClose } = renderDialog(chickenEntry());

      expect(
        screen.getByText("This food has been deleted. Your entry keeps its saved values."),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Update to current food data" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
    });

    it("should say the same when the food can no longer be read", () => {
      api.food = null;
      renderDialog(chickenEntry());

      expect(
        screen.getByText("This food has been deleted. Your entry keeps its saved values."),
      ).toBeTruthy();
    });
  });

  describe("Delete", () => {
    it("should delete the entry at once with the diary's own handler, offer Undo and close", async () => {
      const entry = chickenEntry();
      const { onClose } = renderDialog(entry);

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      expect(api.deleteEntry.mutateAsync).toHaveBeenCalledOnce();
      expect(api.deleteEntry.mutateAsync.mock.calls[0]?.[0]).toBe(entry);
      expect(await screen.findByText("Entry deleted")).toBeTruthy();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("should put the same entry back on Undo", async () => {
      const entry = chickenEntry();
      renderDialog(entry);
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

      expect(api.restoreEntry.mutateAsync).toHaveBeenCalledOnce();
      expect(api.restoreEntry.mutateAsync.mock.calls[0]?.[0]).toBe(entry);
    });
  });

  it("should close on its own when the entry is no longer on the day", () => {
    const entry = chickenEntry();
    const onClose = vi.fn<() => void>();
    api.entries = [];

    render(
      <ToastProvider>
        <EditEntryDialog entryId={entry.id} date={TODAY} opener={null} onClose={onClose} />
      </ToastProvider>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Delete by keyboard from the edit dialog", () => {
  // The diary's rows, and the dialog opened from one row's Edit button, which is the opener.
  function Diary({ entry, openFrom }: { entry: LogEntry; openFrom: "first" | "second" }) {
    const [isOpen, setIsOpen] = useState(false);
    const edit = useRef<HTMLButtonElement>(null);
    const row = (name: string) => (
      <li>
        <button
          ref={name === `Edit ${openFrom}` ? edit : undefined}
          type="button"
          onClick={() => {
            if (name === `Edit ${openFrom}`) {
              setIsOpen(true);
            }
          }}
        >
          {name}
        </button>
      </li>
    );

    return (
      <ToastProvider>
        <ul>
          {row("Edit first")}
          {row("Edit second")}
        </ul>
        {isOpen && (
          <EditEntryDialog
            entryId={entry.id}
            date={TODAY}
            opener={edit.current}
            onClose={() => {
              setIsOpen(false);
            }}
          />
        )}
      </ToastProvider>
    );
  }

  function openFromRow(openFrom: "first" | "second") {
    const entry = chickenEntry();
    api.entries = [entry];
    render(<Diary entry={entry} openFrom={openFrom} />);
    fireEvent.click(screen.getByRole("button", { name: `Edit ${openFrom}` }));
  }

  function deleteByKeyboard() {
    fireEvent.keyDown(document, { key: "Enter" });
    const remove = screen.getByRole("button", { name: "Delete" });
    remove.focus();
    fireEvent.click(remove);
  }

  // The toast takes focus in an effect, a moment after it is drawn.
  async function findUndoHoldingFocus() {
    const undo = await screen.findByRole("button", { name: "Undo" });
    await waitFor(() => {
      expect(document.activeElement).toBe(undo);
    });

    return undo;
  }

  it("should move focus to Undo", async () => {
    openFromRow("first");

    deleteByKeyboard();

    expect(await findUndoHoldingFocus()).toBe(document.activeElement);
  });

  it("should give focus to the next diary row, not a control in the closing dialog, when the toast is dismissed", async () => {
    openFromRow("first");
    deleteByKeyboard();

    fireEvent.keyDown(await findUndoHoldingFocus(), { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Edit entry" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit second" }));
  });

  it("should give focus to the row before when the row was the last, and not to a control in the dialog, which is after the diary", async () => {
    openFromRow("second");
    deleteByKeyboard();

    fireEvent.keyDown(await findUndoHoldingFocus(), { key: "Escape" });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit first" }));
  });

  it("should leave focus alone after a pointer press", async () => {
    openFromRow("first");
    const remove = screen.getByRole("button", { name: "Delete" });
    fireEvent.pointerDown(remove);
    remove.focus();

    fireEvent.click(remove, { detail: 1 });

    expect(await screen.findByRole("button", { name: "Undo" })).not.toBe(document.activeElement);
  });
});

describe("opening the edit dialog", () => {
  it("should return focus to the control it was opened from when it closes", () => {
    const entry = chickenEntry();
    api.entries = [entry];
    function Host() {
      const [isOpen, setIsOpen] = useState(false);
      const edit = useRef<HTMLButtonElement>(null);

      return (
        <ToastProvider>
          <button
            ref={edit}
            type="button"
            onClick={() => {
              setIsOpen(true);
            }}
          >
            Edit first
          </button>
          {isOpen && (
            <EditEntryDialog
              entryId={entry.id}
              date={TODAY}
              opener={edit.current}
              onClose={() => {
                setIsOpen(false);
              }}
            />
          )}
        </ToastProvider>
      );
    }
    render(<Host />);
    const trigger = screen.getByRole("button", { name: "Edit first" });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(document.activeElement).toBe(trigger);
  });

  it("should put the cursor in the amount of a food entry", () => {
    renderDialog(chickenEntry());

    expect(document.activeElement).toBe(amount());
  });

  it("should save when Enter is pressed in the amount, as the Save button does", async () => {
    const entry = chickenEntry();
    const { onClose } = renderDialog(entry);
    fireEvent.change(amount(), { target: { value: "200" } });

    fireEvent.submit(amount());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(api.updateEntry.mutateAsync).toHaveBeenCalledWith({
      entry,
      amount: { quantity: 200, unit: "g" },
    });
  });
});

describe("the edit entry dialog for a quick add", () => {
  function crisps(): LogEntry {
    return quickEntry({
      date: TODAY,
      time: "12:45",
      label: "Meal deal crisps",
      kcal: 130,
      protein: 2,
      fat: 7,
      carbs: 15,
    });
  }

  const calories = () => screen.getByRole("textbox", { name: /^Calories/ });
  const protein = () => screen.getByRole("textbox", { name: /^Protein/ });
  const carbs = () => screen.getByRole("textbox", { name: /^Carbohydrate/ });
  const fat = () => screen.getByRole("textbox", { name: /^Fat/ });
  const label = () => screen.getByRole("textbox", { name: /^Label/ });
  const save = () => screen.getByRole("button", { name: "Save" });
  const type = (field: HTMLElement, value: string) => {
    fireEvent.change(field, { target: { value } });
  };

  // The one request the dialog made, read without a cast.
  function updateSent(): EntryUpdate {
    const [update] = api.updateEntry.mutateAsync.mock.calls[0] ?? [];
    if (update === undefined) {
      throw new Error("no update was sent");
    }

    return update;
  }

  describe("what it shows", () => {
    it("should show Calories, Protein, Carbohydrate, Fat, Label and Time with the entry's values", () => {
      renderDialog(crisps());

      expect(calories()).toHaveProperty("value", "130");
      expect(protein()).toHaveProperty("value", "2");
      expect(carbs()).toHaveProperty("value", "15");
      expect(fat()).toHaveProperty("value", "7");
      expect(label()).toHaveProperty("value", "Meal deal crisps");
      expect(screen.getByRole("button", { name: "Time 12:45" })).toBeTruthy();
    });

    it("should list the fields in the add dialog's order", () => {
      renderDialog(crisps());

      expect(
        within(dialog())
          .getAllByRole("textbox")
          .map((field) => field.id),
      ).toEqual([calories().id, protein().id, carbs().id, fat().id, label().id]);
    });

    it("should have no hero, and still the note about quick adds", () => {
      renderDialog(crisps());

      expect(screen.queryByRole("group", { name: "Energy and macros, Quick add" })).toBeNull();
      expect(
        screen.getByText(
          'Quick adds count towards the day\'s totals and show as "Quick add" in the diary.',
        ),
      ).toBeTruthy();
    });

    it("should show a macro that was not given, and a label that was not given, as empty", () => {
      renderDialog(quickEntry({ date: TODAY, time: "12:45", label: "", kcal: 90 }));

      expect(protein()).toHaveProperty("value", "");
      expect(carbs()).toHaveProperty("value", "");
      expect(fat()).toHaveProperty("value", "");
      expect(label()).toHaveProperty("value", "");
    });

    it("should have no amount or unit to change", () => {
      renderDialog(crisps());

      expect(screen.queryByRole("textbox", { name: /^Amount/ })).toBeNull();
    });

    it("should put the cursor in Calories", () => {
      renderDialog(crisps());

      expect(document.activeElement).toBe(calories());
    });
  });

  describe("saving what changed", () => {
    it("should send all five values and no time when the calories changed", async () => {
      const entry = crisps();
      const { onClose } = renderDialog(entry);
      type(calories(), "150");

      fireEvent.click(save());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      const update = updateSent();
      expect(update).toEqual({
        entry,
        quick: { kcal: 150, protein_g: 2, carbs_g: 15, fat_g: 7, label: "Meal deal crisps" },
      });
      expect("time" in update).toBe(false);
    });

    it("should send all five values when only a macro changed", async () => {
      const entry = crisps();
      renderDialog(entry);
      type(fat(), "9.5");

      fireEvent.click(save());

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(updateSent()).toEqual({
        entry,
        quick: { kcal: 130, protein_g: 2, carbs_g: 15, fat_g: 9.5, label: "Meal deal crisps" },
      });
    });

    it("should send all five values when only the label changed", async () => {
      const entry = crisps();
      renderDialog(entry);
      type(label(), "  Crisps  ");

      fireEvent.click(save());

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(updateSent()).toEqual({
        entry,
        quick: { kcal: 130, protein_g: 2, carbs_g: 15, fat_g: 7, label: "Crisps" },
      });
    });

    it("should send null for a macro that was cleared, not 0", async () => {
      const entry = crisps();
      renderDialog(entry);
      type(protein(), "");

      fireEvent.click(save());

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      const update = updateSent();
      expect(update.quick?.protein_g).toBeNull();
      expect(update.quick?.carbs_g).toBe(15);
    });

    it("should send null for a label that was cleared", async () => {
      renderDialog(crisps());
      type(label(), "");

      fireEvent.click(save());

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(updateSent().quick?.label).toBeNull();
    });

    it("should send 0 for a macro that was not given and has been set to 0", async () => {
      renderDialog(quickEntry({ date: TODAY, time: "12:45", label: "", kcal: 90 }));
      type(protein(), "0");

      fireEvent.click(save());

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(updateSent().quick).toEqual({
        kcal: 90,
        protein_g: 0,
        carbs_g: null,
        fat_g: null,
        label: null,
      });
    });

    it("should save a new time, and only the time", async () => {
      const entry = crisps();
      const { onClose } = renderDialog(entry);
      fireEvent.click(screen.getByRole("button", { name: "Time 12:45" }));
      fireEvent.click(
        within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "07" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      fireEvent.click(save());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledExactlyOnceWith({
        entry,
        time: { loggedAt: "2026-10-15T07:45:00.000Z", timeZone: "UTC" },
      });
      expect("quick" in updateSent()).toBe(false);
    });

    it("should send the values and the time together when both changed", async () => {
      renderDialog(crisps());
      type(calories(), "140");
      fireEvent.click(screen.getByRole("button", { name: "Time 12:45" }));
      fireEvent.click(
        within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "07" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      fireEvent.click(save());

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      const update = updateSent();
      expect(update.quick?.kcal).toBe(140);
      expect(update.time).toEqual({ loggedAt: "2026-10-15T07:45:00.000Z", timeZone: "UTC" });
    });

    it("should close on Save with nothing changed, without a request", async () => {
      const { onClose } = renderDialog(crisps());

      fireEvent.click(save());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
    });

    it("should send nothing when a value is typed again as it was", async () => {
      const { onClose } = renderDialog(crisps());
      type(calories(), "130.0");
      type(label(), "Meal deal crisps ");

      fireEvent.click(save());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
    });

    it("should save when Enter is pressed in a field, as the Save button does", async () => {
      const { onClose } = renderDialog(crisps());
      type(calories(), "150");

      fireEvent.submit(calories());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(updateSent().quick?.kcal).toBe(150);
    });

    it("should stay open with the error banner, keeping what was typed, when the save fails", async () => {
      api.updateEntry.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW 150 kcal failure")));
      const { onClose } = renderDialog(crisps());
      type(calories(), "150");
      type(label(), "Crisps");

      fireEvent.click(save());

      expect(
        await screen.findByText("Not saved. Check your connection and try again."),
      ).toBeTruthy();
      expect(screen.queryByText(/RAW/)).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      expect(calories()).toHaveProperty("value", "150");
      expect(label()).toHaveProperty("value", "Crisps");
    });
  });

  describe("the calories", () => {
    it("should disable Save and say Enter calories once they are cleared", () => {
      renderDialog(crisps());

      type(calories(), "");

      expect(save()).toHaveProperty("disabled", true);
      expect(screen.getByText("Enter calories.")).toBeTruthy();
    });

    it("should disable Save and say Enter calories for 0", () => {
      renderDialog(crisps());

      type(calories(), "0");

      expect(save()).toHaveProperty("disabled", true);
      expect(screen.getByText("Enter calories.")).toBeTruthy();
    });

    it("should not save on Enter while the calories are not above 0", () => {
      renderDialog(crisps());
      type(calories(), "0");

      fireEvent.submit(calories());

      expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
    });

    it("should keep digits and one point or comma, and refuse anything else", () => {
      renderDialog(crisps());

      type(protein(), "1a");

      expect(protein()).toHaveProperty("value", "2");
    });
  });

  describe("the line under Calories", () => {
    const line = (text: string) => screen.getByText(text);
    const isWarning = (text: string) => line(text).className.includes("text-warning-ink");

    it("should say what the macros add up to", () => {
      renderDialog(crisps());

      expect(screen.getByText("Macros add up to 131 kcal")).toBeTruthy();
    });

    it("should say the macros are optional when none was given", () => {
      renderDialog(quickEntry({ date: TODAY, time: "12:45", label: "", kcal: 90 }));

      expect(screen.getByText("Macros are optional")).toBeTruthy();
    });

    it("should stay plain at exactly a quarter above the calories and warn just over it", () => {
      renderDialog(crisps());
      type(calories(), "130");

      // 40.5 g of protein is 162 kcal: 32 kcal over, which is under a quarter of 130.
      type(protein(), "40.5");
      type(carbs(), "");
      type(fat(), "");
      expect(isWarning("Macros add up to 162 kcal")).toBe(false);

      // 40.75 g of protein is 163 kcal: 33 kcal over, which is more than a quarter of 130.
      type(protein(), "40.75");
      expect(isWarning("Macros add up to 163 kcal")).toBe(true);
    });

    it("should stay plain at a quarter below the calories and warn just under it", () => {
      renderDialog(crisps());
      type(calories(), "130");
      type(carbs(), "");
      type(fat(), "");

      type(protein(), "24.5");
      expect(isWarning("Macros add up to 98 kcal")).toBe(false);

      type(protein(), "24.25");
      expect(isWarning("Macros add up to 97 kcal")).toBe(true);
    });

    it("should be information only: Save is still allowed", () => {
      renderDialog(crisps());
      type(calories(), "130");
      type(protein(), "60");
      type(carbs(), "");
      type(fat(), "");

      expect(isWarning("Macros add up to 240 kcal")).toBe(true);
      expect(save()).toHaveProperty("disabled", false);
    });
  });

  it("should delete with Undo, like any entry", () => {
    const entry = crisps();
    renderDialog(entry);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(api.deleteEntry.mutateAsync.mock.calls[0]?.[0]).toBe(entry);
  });
});

describe("the edit entry dialog offline", () => {
  const setOnline = (isOnline: boolean) => {
    act(() => {
      onlineManager.setOnline(isOnline);
    });
  };
  const save = () => screen.getByRole("button", { name: "Save" });
  const remove = () => screen.getByRole("button", { name: "Delete" });
  const crispsEntry = (): LogEntry =>
    quickEntry({ date: TODAY, time: "12:45", label: "Crisps", kcal: 130 });

  describe.each([
    ["a logged food", chickenEntry, () => amount(), "200"],
    ["a quick add", crispsEntry, () => screen.getByRole("textbox", { name: /^Calories/ }), "150"],
  ])("for %s", (_name, makeEntry, field, typed) => {
    it("should disable Save, and save nothing, even when the form is submitted", () => {
      renderDialog(makeEntry());
      fireEvent.change(field(), { target: { value: typed } });

      setOnline(false);
      fireEvent.click(save());
      fireEvent.submit(field());

      expect(save()).toHaveProperty("disabled", true);
      expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
    });

    it("should disable Delete, and delete nothing", () => {
      renderDialog(makeEntry());

      setOnline(false);
      fireEvent.click(remove());

      expect(remove()).toHaveProperty("disabled", true);
      expect(api.deleteEntry.mutateAsync).not.toHaveBeenCalled();
    });

    it("should keep what was typed when the connection drops and when it returns", () => {
      renderDialog(makeEntry());
      fireEvent.change(field(), { target: { value: typed } });

      setOnline(false);
      expect(field()).toHaveProperty("value", typed);

      setOnline(true);
      expect(field()).toHaveProperty("value", typed);
    });

    it("should save what was typed once the connection returns", async () => {
      const { onClose } = renderDialog(makeEntry());
      fireEvent.change(field(), { target: { value: typed } });
      setOnline(false);
      setOnline(true);

      fireEvent.click(save());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
    });

    it("should leave Cancel alone", () => {
      const { onClose } = renderDialog(makeEntry());
      setOnline(false);

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
