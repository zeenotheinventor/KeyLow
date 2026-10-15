import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { diaryDay, foodEntry, quickEntry } from "./support";
import { makeFood } from "../foods/support";

import type { DiaryDay, EntryUpdate, LogEntry } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";

import { EditEntryDialog } from "@/components/diary/EditEntryDialog";
import { ToastProvider } from "@/components/ui/Toast";

type Api = {
  timeZone: string;
  entries: LogEntry[];
  food: Food | null | undefined;
  updateEntry: {
    mutateAsync: ReturnType<typeof vi.fn<(update: EntryUpdate) => Promise<LogEntry>>>;
  };
  deleteEntry: { mutate: ReturnType<typeof vi.fn<(entry: LogEntry) => void>> };
  restoreEntry: { mutate: ReturnType<typeof vi.fn<(entry: LogEntry) => void>> };
};

const api = vi.hoisted((): Api => ({
  timeZone: "UTC",
  entries: [],
  food: undefined,
  updateEntry: { mutateAsync: undefined as never },
  deleteEntry: { mutate: undefined as never },
  restoreEntry: { mutate: undefined as never },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: api.timeZone }),
  useDiaryDay: (date: string): { data: DiaryDay } => ({ data: diaryDay(date, api.entries) }),
  useFood: () => ({ data: api.food }),
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

function chickenEntry(): LogEntry {
  return foodEntry({
    date: TODAY,
    time: "12:40",
    name: chickenName,
    quantity: 150,
    unit: "g",
    kcal: 150,
    protein: 15,
    fat: 7.5,
    carbs: 30,
  });
}

function renderDialog(entry: LogEntry) {
  api.entries = [entry];
  const onClose = vi.fn<() => void>();
  render(
    <ToastProvider>
      <EditEntryDialog entryId={entry.id} date={TODAY} onClose={onClose} />
    </ToastProvider>,
  );

  return { onClose };
}

const dialog = () => screen.getByRole("dialog", { name: "Edit entry" });
const amount = () => screen.getByRole("textbox", { name: /^Amount/ });

beforeEach(() => {
  api.timeZone = "UTC";
  api.food = loggedFood();
  api.updateEntry.mutateAsync = vi.fn((update: EntryUpdate) => Promise.resolve(update.entry));
  api.deleteEntry.mutate = vi.fn<(entry: LogEntry) => void>();
  api.restoreEntry.mutate = vi.fn<(entry: LogEntry) => void>();
});

afterEach(() => {
  cleanup();
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
    function chooseTime(hour: string) {
      fireEvent.click(screen.getByRole("button", { name: "Time 12:40" }));
      fireEvent.click(
        within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: hour }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Done" }));
    }

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
  });

  it("should offer no update while the food is as it was logged", () => {
    renderDialog(chickenEntry());

    expect(screen.queryByText("This food has changed since you logged it.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Update to current food data" })).toBeNull();
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
    it("should delete the entry at once with the diary's own handler, offer Undo and close", () => {
      const entry = chickenEntry();
      const { onClose } = renderDialog(entry);

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      expect(api.deleteEntry.mutate).toHaveBeenCalledOnce();
      expect(api.deleteEntry.mutate.mock.calls[0]?.[0]).toBe(entry);
      expect(screen.getByText("Entry deleted")).toBeTruthy();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("should put the same entry back on Undo", () => {
      const entry = chickenEntry();
      renderDialog(entry);
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      expect(api.restoreEntry.mutate).toHaveBeenCalledOnce();
      expect(api.restoreEntry.mutate.mock.calls[0]?.[0]).toBe(entry);
    });
  });

  it("should close on its own when the entry is no longer on the day", () => {
    const entry = chickenEntry();
    const onClose = vi.fn<() => void>();
    api.entries = [];

    render(
      <ToastProvider>
        <EditEntryDialog entryId={entry.id} date={TODAY} onClose={onClose} />
      </ToastProvider>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onClose).toHaveBeenCalled();
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

  it("should show what the quick add was logged with, and the note about quick adds", () => {
    renderDialog(crisps());

    const hero = screen.getByRole("group", { name: "Energy and macros, Quick add" });
    expect(within(hero).getByText("Meal deal crisps")).toBeTruthy();
    expect(within(hero).getByText("130")).toBeTruthy();
    expect(
      screen.getByText(
        'Quick adds count towards the day\'s totals and show as "Quick add" in the diary.',
      ),
    ).toBeTruthy();
  });

  it("should have no amount or unit to change, and the entry's own time", () => {
    renderDialog(crisps());

    expect(screen.queryByRole("textbox", { name: /^Amount/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Time 12:45" })).toBeTruthy();
  });

  it("should save a new time, and only the time", async () => {
    const entry = crisps();
    const { onClose } = renderDialog(entry);
    fireEvent.click(screen.getByRole("button", { name: "Time 12:45" }));
    fireEvent.click(
      within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "07" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(api.updateEntry.mutateAsync).toHaveBeenCalledExactlyOnceWith({
      entry,
      time: { loggedAt: "2026-10-15T07:45:00.000Z", timeZone: "UTC" },
    });
  });

  it("should close on Save with nothing changed, without a request", async () => {
    const { onClose } = renderDialog(crisps());

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
  });

  it("should delete with Undo, like any entry", () => {
    const entry = crisps();
    renderDialog(entry);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(api.deleteEntry.mutate.mock.calls[0]?.[0]).toBe(entry);
  });
});
