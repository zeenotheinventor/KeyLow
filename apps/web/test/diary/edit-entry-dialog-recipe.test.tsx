import { SAVE_FAILED_BANNER } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { boardRecipeTotal, diaryDay, recipeEntry } from "./support";

import type { DiaryDay, EntryUpdate, LogEntry } from "@keylow/api-client";

import { EditEntryDialog } from "@/components/diary/EditEntryDialog";
import { sampleRecipes } from "@/components/recipes/sampleRecipes";
import { ToastProvider } from "@/components/ui/Toast";

type LiveRecipe =
  | { status: "loading" }
  | { status: "error"; debugMessage: string }
  | { status: "notFound" }
  | { status: "ready"; recipe: { is_archived: boolean } & Record<string, unknown> };

type Api = {
  timeZone: string;
  entries: LogEntry[];
  liveRecipe: LiveRecipe;
  recipeIdsRead: (string | undefined)[];
  updateEntry: {
    mutateAsync: ReturnType<typeof vi.fn<(update: EntryUpdate) => Promise<LogEntry>>>;
  };
  deleteEntry: { mutateAsync: ReturnType<typeof vi.fn<(entry: LogEntry) => Promise<void>>> };
  restoreEntry: { mutateAsync: ReturnType<typeof vi.fn<(entry: LogEntry) => Promise<void>>> };
};

const api = vi.hoisted((): Api => ({
  timeZone: "UTC",
  entries: [],
  liveRecipe: { status: "loading" },
  recipeIdsRead: [],
  updateEntry: { mutateAsync: undefined as never },
  deleteEntry: { mutateAsync: undefined as never },
  restoreEntry: { mutateAsync: undefined as never },
}));

// The diary day, the writes and the live recipe are fakes. Everything the dialog works out is real core.
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: api.timeZone }),
  useDiaryDay: (date: string): { data: DiaryDay } => ({ data: diaryDay(date, api.entries) }),
  useRecipe: (id: string | undefined) => {
    api.recipeIdsRead.push(id);
    return api.liveRecipe;
  },
  useUpdateEntry: () => api.updateEntry,
  useDeleteEntry: () => api.deleteEntry,
  useRestoreEntry: () => api.restoreEntry,
}));

const TODAY = "2026-10-15";

const ARCHIVED_NOTICE = "This recipe has been archived. Your entry keeps its saved values.";

const sampleChickenAndRice = sampleRecipes.find((recipe) => recipe.name === "Chicken and rice");
if (sampleChickenAndRice === undefined) {
  throw new Error("The sample recipes have no Chicken and rice");
}

const liveRecipe = (isArchived: boolean): LiveRecipe => ({
  status: "ready",
  recipe: { ...sampleChickenAndRice, is_archived: isArchived },
});

/** The recipe as it is now, edited since the entry was logged: another name, two servings, double the totals. */
const editedSince = (): LiveRecipe => {
  const { total } = sampleChickenAndRice.computed;

  return {
    status: "ready",
    recipe: {
      ...sampleChickenAndRice,
      name: "Chicken and rice, new recipe",
      servings: 2,
      yield_grams: 600,
      is_archived: false,
      computed: {
        ...sampleChickenAndRice.computed,
        effectiveGrams: 600,
        total: { ...total, kcal: (total.kcal ?? 0) * 2 },
        perServing: { ...sampleChickenAndRice.computed.perServing, kcal: 1000 },
        per100g: { ...sampleChickenAndRice.computed.per100g, kcal: 500 },
      },
    },
  };
};

function renderDialog(entry: LogEntry) {
  api.entries = [entry];
  const onClose = vi.fn<() => void>();
  render(
    <ToastProvider>
      <EditEntryDialog entryId={entry.id} date={TODAY} opener={null} onClose={onClose} />
    </ToastProvider>,
  );

  return { onClose };
}

// The boards' own totals for the recipe, so the figures read as the boards print them.
const boardEntry = (options: Partial<Parameters<typeof recipeEntry>[0]> = {}): LogEntry =>
  recipeEntry({ date: TODAY, time: "18:00", total: boardRecipeTotal, ...options });
const servingEntry = (): LogEntry => boardEntry();
const gramsEntry = (): LogEntry => boardEntry({ quantity: 300, unit: "g" });

const dialog = () => screen.getByRole("dialog", { name: "Edit entry" });
const amount = () => screen.getByRole("textbox", { name: /^Amount/ });
const hero = (caption: string) =>
  screen.getByRole("group", { name: `Energy and macros, ${caption}` });
const unitChip = (name: string) => screen.getByRole("radio", { name });
const save = () => screen.getByRole("button", { name: "Save" });
const remove = () => screen.getByRole("button", { name: "Delete" });
const per100 = (heading: string) => screen.getByRole("table", { name: heading });

function chooseTime(from: string, hour: string) {
  fireEvent.click(screen.getByRole("button", { name: `Time ${from}` }));
  fireEvent.click(
    within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: hour }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
}

const calledUpdates = () => api.updateEntry.mutateAsync.mock.calls.map(([update]) => update);

beforeEach(() => {
  api.timeZone = "UTC";
  api.liveRecipe = liveRecipe(false);
  api.recipeIdsRead = [];
  api.updateEntry.mutateAsync = vi.fn((update: EntryUpdate) => Promise.resolve(update.entry));
  api.deleteEntry.mutateAsync = vi.fn(() => Promise.resolve());
  api.restoreEntry.mutateAsync = vi.fn(() => Promise.resolve());
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("the edit entry dialog for a logged recipe", () => {
  describe("a serving, as logged", () => {
    it("should be titled Edit entry, with the Recipe badge and the yield it was logged with", () => {
      renderDialog(servingEntry());

      expect(dialog()).toBeTruthy();
      expect(screen.getByText("Recipe")).toBeTruthy();
      expect(screen.getByText("Makes 4 · 1,100 g cooked")).toBeTruthy();
    });

    it("should show 374 kcal for 1 serving (275 g) with its macros", () => {
      renderDialog(servingEntry());

      const card = hero("For 1 serving (275 g)");

      expect(within(card).getByText("Chicken and rice")).toBeTruthy();
      expect(within(card).getByText("374")).toBeTruthy();
      expect(within(card).getByText("32 g")).toBeTruthy();
      expect(within(card).getByText("43 g")).toBeTruthy();
      expect(within(card).getByText("8.1 g")).toBeTruthy();
    });

    it("should list the values per 100 g of the cooked dish", () => {
      renderDialog(servingEntry());

      expect(
        within(per100("Per 100 g cooked"))
          .getAllByRole("row")
          .map((row) => row.textContent),
      ).toEqual(["Energy136 kcal", "Protein12 g", "Carbohydrate15 g", "Fat3 g"]);
    });

    it("should show the amount as logged, the serving chip chosen, and the entry's own time", () => {
      renderDialog(servingEntry());

      expect(amount()).toHaveProperty("value", "1");
      expect(screen.getByText("serving")).toBeTruthy();
      expect(unitChip("1 serving").getAttribute("aria-checked")).toBe("true");
      expect(unitChip("g").getAttribute("aria-checked")).toBe("false");
      expect(screen.getByRole("button", { name: "Time 18:00" })).toBeTruthy();
      expect(screen.queryByText("Now")).toBeNull();
    });

    it("should put the cursor in the amount", () => {
      renderDialog(servingEntry());

      expect(document.activeElement).toBe(amount());
    });

    it("should have a leading Delete, then Cancel and Save, and no Results link", () => {
      renderDialog(servingEntry());

      const buttons = within(dialog())
        .getAllByRole("button")
        .map((button) => button.textContent);

      expect(buttons.slice(-3)).toEqual(["Delete", "Cancel", "Save"]);
      expect(screen.queryByRole("button", { name: "Results" })).toBeNull();
    });
  });

  describe("grams, as logged", () => {
    it("should show 408 kcal for 300 g with the g chip chosen", () => {
      renderDialog(gramsEntry());

      const card = hero("For 300 g");

      expect(within(card).getByText("408")).toBeTruthy();
      expect(within(card).getByText("35 g")).toBeTruthy();
      expect(within(card).getByText("46 g")).toBeTruthy();
      expect(within(card).getByText("8.9 g")).toBeTruthy();
      expect(amount()).toHaveProperty("value", "300");
      expect(unitChip("g").getAttribute("aria-checked")).toBe("true");
    });

    it("should say nothing about raw grams while the recipe had a cooked weight", () => {
      renderDialog(gramsEntry());

      expect(screen.queryByText(/No cooked weight is set/)).toBeNull();
    });
  });

  describe("a recipe logged with no cooked weight", () => {
    it("should say so, list the values per 100 g raw, and explain the raw grams under the hero", () => {
      renderDialog(boardEntry({ quantity: 275, unit: "g", yieldGrams: null }));

      expect(screen.getByText("Makes 4 · no cooked weight")).toBeTruthy();
      expect(per100("Per 100 g raw")).toBeTruthy();
      const note = screen.getByText(
        "No cooked weight is set, so these grams are of the raw ingredients (720 g in total).",
      );
      expect(hero("For 275 g").getAttribute("aria-describedby")).toBe(note.id);
    });
  });

  describe("what was frozen when it was logged", () => {
    it("should show the entry's own figures however the recipe has been edited since", () => {
      api.liveRecipe = editedSince();
      renderDialog(servingEntry());

      expect(screen.getByText("Makes 4 · 1,100 g cooked")).toBeTruthy();
      expect(within(hero("For 1 serving (275 g)")).getByText("Chicken and rice")).toBeTruthy();
      expect(within(hero("For 1 serving (275 g)")).getByText("374")).toBeTruthy();
      expect(
        within(per100("Per 100 g cooked"))
          .getAllByRole("row")
          .map((row) => row.textContent),
      ).toEqual(["Energy136 kcal", "Protein12 g", "Carbohydrate15 g", "Fat3 g"]);
      expect(screen.queryByText(/new recipe/)).toBeNull();
    });

    it("should work an edited amount out from the entry's own snapshot, not the recipe as it is now", () => {
      api.liveRecipe = editedSince();
      renderDialog(servingEntry());

      fireEvent.change(amount(), { target: { value: "1.5" } });

      expect(within(hero("For 1.5 servings (413 g)")).getByText("561")).toBeTruthy();
    });

    it("should never offer to update the entry to the current recipe", () => {
      api.liveRecipe = editedSince();
      renderDialog(servingEntry());

      expect(screen.queryByRole("button", { name: /update/i })).toBeNull();
      expect(screen.queryByText(/update to current/i)).toBeNull();
    });

    it("should read the live recipe by the entry's recipe id, and only for whether it is archived", () => {
      const entry = servingEntry();
      renderDialog(entry);

      expect(api.recipeIdsRead.every((id) => id === "44444444-4444-4444-8444-444444444444")).toBe(
        true,
      );
      expect(api.recipeIdsRead.length).toBeGreaterThan(0);
    });
  });

  describe("an archived recipe", () => {
    it("should say the entry keeps its saved values", () => {
      api.liveRecipe = liveRecipe(true);
      renderDialog(servingEntry());

      expect(screen.getByText(ARCHIVED_NOTICE)).toBeTruthy();
    });

    it("should still show the saved figures", () => {
      api.liveRecipe = liveRecipe(true);
      renderDialog(servingEntry());

      expect(within(hero("For 1 serving (275 g)")).getByText("374")).toBeTruthy();
    });

    it("should still save a new amount and time", async () => {
      api.liveRecipe = liveRecipe(true);
      const entry = servingEntry();
      const { onClose } = renderDialog(entry);
      fireEvent.change(amount(), { target: { value: "2" } });

      fireEvent.click(save());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(calledUpdates()).toEqual([{ entry, amount: { quantity: 2, unit: "serving" } }]);
    });

    it("should still delete with Undo", async () => {
      api.liveRecipe = liveRecipe(true);
      const entry = servingEntry();
      renderDialog(entry);

      fireEvent.click(remove());

      expect(api.deleteEntry.mutateAsync).toHaveBeenCalledExactlyOnceWith(entry);
      expect(await screen.findByRole("button", { name: "Undo" })).toBeTruthy();
    });

    it.each([
      ["live", liveRecipe(false)],
      ["still loading", { status: "loading" } as const],
      ["not readable", { status: "error", debugMessage: "RAW 374 kcal failure" } as const],
      ["not found", { status: "notFound" } as const],
    ])("should show no notice when the recipe is %s, and edit normally", (_name, state) => {
      api.liveRecipe = state;
      renderDialog(servingEntry());

      expect(screen.queryByText(ARCHIVED_NOTICE)).toBeNull();
      expect(screen.queryByText(/RAW/)).toBeNull();
      expect(save()).toHaveProperty("disabled", false);
    });
  });

  describe("Save", () => {
    it("should write 1.5 servings once, with no time, and close", async () => {
      const entry = servingEntry();
      const { onClose } = renderDialog(entry);
      fireEvent.change(amount(), { target: { value: "1.5" } });

      fireEvent.click(save());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(calledUpdates()).toEqual([{ entry, amount: { quantity: 1.5, unit: "serving" } }]);
    });

    it("should write grams of the cooked weight, as the g chip chosen", async () => {
      const entry = servingEntry();
      renderDialog(entry);

      fireEvent.click(unitChip("g"));
      expect(amount()).toHaveProperty("value", "100");
      fireEvent.change(amount(), { target: { value: "300" } });
      fireEvent.click(save());

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(calledUpdates()).toEqual([{ entry, amount: { quantity: 300, unit: "g" } }]);
    });

    it("should write a change of unit at the same number, since 1 serving and 1 g differ", async () => {
      const entry = servingEntry();
      renderDialog(entry);

      fireEvent.click(unitChip("g"));
      fireEvent.change(amount(), { target: { value: "1" } });
      fireEvent.click(save());

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(calledUpdates()).toEqual([{ entry, amount: { quantity: 1, unit: "g" } }]);
    });

    it("should write only the time when only the time changed, in the profile's zone", async () => {
      api.timeZone = "Europe/London";
      const entry = boardEntry({ time: "17:00" });
      renderDialog(entry);

      chooseTime("18:00", "20");
      fireEvent.click(save());

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(calledUpdates()).toEqual([
        { entry, time: { loggedAt: "2026-10-15T19:00:00.000Z", timeZone: "Europe/London" } },
      ]);
    });

    it("should write the instant of a time that is on another date in UTC, on the entry's own day", async () => {
      // 05:00 on 15 October in Auckland (UTC+13) is still the evening of 14 October in UTC.
      api.timeZone = "Pacific/Auckland";
      const entry = boardEntry({ time: "18:00" });
      renderDialog(entry);

      chooseTime("07:00", "05");
      fireEvent.click(save());

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(calledUpdates()).toEqual([
        { entry, time: { loggedAt: "2026-10-14T16:00:00.000Z", timeZone: "Pacific/Auckland" } },
      ]);
    });

    it("should write the amount and the time together in one request", async () => {
      const entry = servingEntry();
      renderDialog(entry);

      fireEvent.change(amount(), { target: { value: "2" } });
      chooseTime("18:00", "19");
      fireEvent.click(save());

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(calledUpdates()).toEqual([
        {
          entry,
          amount: { quantity: 2, unit: "serving" },
          time: { loggedAt: "2026-10-15T19:00:00.000Z", timeZone: "UTC" },
        },
      ]);
    });

    it("should write nothing, and close, when nothing changed", async () => {
      const { onClose } = renderDialog(servingEntry());

      fireEvent.click(save());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
    });

    it("should write nothing when the amount is typed back to what was logged", async () => {
      const { onClose } = renderDialog(servingEntry());
      fireEvent.change(amount(), { target: { value: "2" } });
      fireEvent.change(amount(), { target: { value: "1" } });

      fireEvent.click(save());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
    });

    it.each(["", "0", "-1", "abc", "1e308"])(
      "should ask for an amount above 0 and turn Save off for %j",
      (text) => {
        renderDialog(servingEntry());

        fireEvent.change(amount(), { target: { value: text } });

        expect(screen.getByText("Enter an amount above 0.")).toBeTruthy();
        expect(save()).toHaveProperty("disabled", true);
        expect(within(hero("For this amount")).getAllByText("–")).toHaveLength(4);
      },
    );

    it("should stay open with a banner, never the raw failure, when the save fails", async () => {
      api.updateEntry.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW 561 kcal failure")));
      const { onClose } = renderDialog(servingEntry());
      fireEvent.change(amount(), { target: { value: "1.5" } });
      expect(screen.queryByText(SAVE_FAILED_BANNER)).toBeNull();

      fireEvent.click(save());

      expect(await screen.findByText(SAVE_FAILED_BANNER)).toBeTruthy();
      expect(screen.queryByText(/RAW/)).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      expect(amount()).toHaveProperty("value", "1.5");
    });

    it("should clear the banner when the save is tried again, and close once it works", async () => {
      let finishRetry: () => void = () => undefined;
      const entry = servingEntry();
      api.updateEntry.mutateAsync = vi
        .fn<(update: EntryUpdate) => Promise<LogEntry>>()
        .mockRejectedValueOnce(new Error("RAW 561 kcal failure"))
        .mockImplementationOnce(
          () =>
            new Promise<LogEntry>((resolve) => {
              finishRetry = () => {
                resolve(entry);
              };
            }),
        );
      const { onClose } = renderDialog(entry);
      fireEvent.change(amount(), { target: { value: "1.5" } });
      fireEvent.click(save());
      await screen.findByText(SAVE_FAILED_BANNER);

      fireEvent.click(save());

      await waitFor(() => {
        expect(screen.queryByText(SAVE_FAILED_BANNER)).toBeNull();
      });
      expect(onClose).not.toHaveBeenCalled();
      act(() => {
        finishRetry();
      });
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledTimes(2);
    });

    it("should close on Cancel and Escape without saving", () => {
      const { onClose } = renderDialog(servingEntry());
      fireEvent.change(amount(), { target: { value: "2" } });

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(2);
      expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
    });
  });

  describe("Delete", () => {
    it("should delete the entry at once with the diary's own handler, offer Undo and close", async () => {
      const entry = servingEntry();
      const { onClose } = renderDialog(entry);

      fireEvent.click(remove());

      expect(api.deleteEntry.mutateAsync).toHaveBeenCalledExactlyOnceWith(entry);
      expect(await screen.findByText("Entry deleted")).toBeTruthy();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("should put the same entry back on Undo", async () => {
      const entry = servingEntry();
      renderDialog(entry);
      fireEvent.click(remove());

      fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

      expect(api.restoreEntry.mutateAsync).toHaveBeenCalledExactlyOnceWith(entry);
    });
  });

  describe("offline", () => {
    const setOnline = (isOnline: boolean) => {
      act(() => {
        onlineManager.setOnline(isOnline);
      });
    };

    it("should disable Save, and save nothing, even when the form is submitted", () => {
      renderDialog(servingEntry());
      fireEvent.change(amount(), { target: { value: "2" } });

      setOnline(false);
      fireEvent.click(save());
      fireEvent.submit(amount());

      expect(save()).toHaveProperty("disabled", true);
      expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
    });

    it("should disable Delete, and delete nothing", () => {
      renderDialog(servingEntry());

      setOnline(false);
      fireEvent.click(remove());

      expect(remove()).toHaveProperty("disabled", true);
      expect(api.deleteEntry.mutateAsync).not.toHaveBeenCalled();
    });

    it("should leave Cancel alone", () => {
      const { onClose } = renderDialog(servingEntry());
      setOnline(false);

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  it("should close on its own when the entry is no longer on the day", () => {
    const entry = servingEntry();
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
