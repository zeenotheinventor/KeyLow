import { buildLogEntry } from "@keylow/core/diary";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { oliveOil } from "./portionFoods";
import { diaryDay, foodEntry } from "./support";

import type { EntryUpdate, LogEntry } from "@keylow/api-client";
import type { BuildLogEntryInput } from "@keylow/core/diary";

import { EditEntryDialog } from "@/components/diary/EditEntryDialog";
import { ToastProvider } from "@/components/ui/Toast";

type Api = {
  entries: LogEntry[];
  updateEntry: {
    mutateAsync: ReturnType<typeof vi.fn<(update: EntryUpdate) => Promise<LogEntry>>>;
  };
};

const api = vi.hoisted((): Api => ({
  entries: [],
  updateEntry: { mutateAsync: undefined as never },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "UTC" }),
  useDiaryDay: (date: string) => ({ data: diaryDay(date, api.entries) }),
  useFood: () => ({ data: oliveOil.food }),
  useUpdateEntry: () => api.updateEntry,
  useDeleteEntry: () => ({ mutateAsync: () => Promise.resolve() }),
  useRestoreEntry: () => ({ mutateAsync: () => Promise.resolve() }),
}));

const TODAY = "2026-10-15";
const tablespoon = { id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: 15 };

/** A stored oil entry: what the database layer builds for the amount, with the columns the database adds. */
function oilEntry(
  amount: Pick<BuildLogEntryInput, "quantity" | "unit" | "portion">,
  food = oliveOil.food,
): LogEntry {
  const built = buildLogEntry({
    food,
    localDate: TODAY,
    loggedAt: `${TODAY}T12:40:00+00:00`,
    ...amount,
  });

  return {
    ...built,
    id: "00000000-0000-4000-8000-0000000000aa",
    created_at: "2026-10-15T12:40:30+00:00",
    kcal: built.nutrients.kcal,
  };
}

function renderDialog(entry: LogEntry) {
  api.entries = [entry];
  render(
    <ToastProvider>
      <EditEntryDialog
        entryId={entry.id}
        date={TODAY}
        opener={null}
        onClose={vi.fn<() => void>()}
      />
    </ToastProvider>,
  );
}

const chipNames = () => screen.getAllByRole("radio").map((chip) => chip.textContent);
const amountField = (unit: string) => screen.getByRole("textbox", { name: `Amount (${unit})` });
const save = () => {
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
};

beforeEach(() => {
  api.updateEntry.mutateAsync = vi.fn((update: EntryUpdate) => Promise.resolve(update.entry));
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("the edit dialog's chips", () => {
  describe("an entry logged in spoons", () => {
    const twoTablespoons = () => oilEntry({ quantity: 2, unit: "portion", portion: tablespoon });

    it("should show the spoon chip once, selected, in the add dialog's order", () => {
      renderDialog(twoTablespoons());

      expect(chipNames()).toEqual(["g", "ml", "1 tsp", "1 tbsp"]);
      expect(screen.getAllByRole("radio", { name: "1 tbsp" })).toHaveLength(1);
      expect(screen.getByRole("radio", { name: "1 tbsp", checked: true })).toBeTruthy();
    });

    it("should show the count and the spoon's volume and weight from the entry's own snapshot", () => {
      renderDialog(twoTablespoons());

      expect(amountField("tbsp")).toHaveProperty("value", "2");
      expect(
        screen.getByRole("group", { name: "Energy and macros, For 2 tbsp (30 ml, 28 g)" }),
      ).toBeTruthy();
    });

    it("should save a changed count with the spoon as its portion and no link to a portion row", async () => {
      const entry = twoTablespoons();
      renderDialog(entry);

      fireEvent.change(amountField("tbsp"), { target: { value: "3" } });
      save();

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledWith({
        entry,
        amount: { quantity: 3, unit: "portion", portion: { label: "1 tbsp", ml: 15 } },
      });
    });

    it("should save a change to millilitres as a plain volume", async () => {
      const entry = twoTablespoons();
      renderDialog(entry);

      fireEvent.click(screen.getByRole("radio", { name: "ml" }));
      fireEvent.change(amountField("ml"), { target: { value: "30" } });
      save();

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledWith({
        entry,
        amount: { quantity: 30, unit: "ml" },
      });
    });
  });

  describe("an entry logged in a unit that has a density", () => {
    it("should offer the spoons and save a change to one with the spoon as its portion", async () => {
      const entry = oilEntry({ quantity: 20, unit: "g" });
      renderDialog(entry);
      expect(chipNames()).toEqual(["g", "ml", "1 tsp", "1 tbsp"]);

      fireEvent.click(screen.getByRole("radio", { name: "1 tsp" }));
      fireEvent.change(amountField("tsp"), { target: { value: "4" } });

      expect(
        screen.getByRole("group", { name: "Energy and macros, For 4 tsp (20 ml, 18 g)" }),
      ).toBeTruthy();
      save();
      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledWith({
        entry,
        amount: { quantity: 4, unit: "portion", portion: { label: "1 tsp", ml: 5 } },
      });
    });

    it("should use the density it was logged with, not the food's now", () => {
      const oilLoggedAtAnotherDensity = { ...oliveOil.food, density_g_per_ml: 0.9 };
      renderDialog(
        oilEntry({ quantity: 2, unit: "portion", portion: tablespoon }, oilLoggedAtAnotherDensity),
      );

      expect(
        screen.getByRole("group", { name: "Energy and macros, For 2 tbsp (30 ml, 27 g)" }),
      ).toBeTruthy();
    });
  });

  describe("an entry logged before the density was kept", () => {
    function gramEntry(): LogEntry {
      return foodEntry({
        date: TODAY,
        time: "12:40",
        name: "Chicken breast, grilled",
        quantity: 150,
        unit: "g",
        kcal: 150,
        protein: 15,
        fat: 7.5,
        carbs: 30,
      });
    }

    it("should show only grams, with its numbers as they were", () => {
      renderDialog(gramEntry());

      expect(chipNames()).toEqual(["g"]);
      const hero = screen.getByRole("group", { name: "Energy and macros, For 150 g" });
      expect(within(hero).getByText("150")).toBeTruthy();
    });

    it("should show its portion then grams, and no spoon, for an entry logged in a portion", () => {
      renderDialog(
        foodEntry({
          date: TODAY,
          time: "12:40",
          name: "Banana",
          quantity: 1,
          unit: "portion",
          kcal: 95,
          protein: 1.2,
          fat: 0.1,
          carbs: 20.3,
        }),
      );

      expect(chipNames()).toEqual(["1 medium", "g"]);
      expect(screen.getByRole("radio", { name: "1 medium", checked: true })).toBeTruthy();
    });
  });
});
