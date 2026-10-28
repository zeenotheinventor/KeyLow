import { buildLogEntry } from "@keylow/core/diary";
import { buildFoodPortion } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { banana, oliveOil } from "./portionFoods";
import { diaryDay, foodEntry } from "./support";

import type { EntryUpdate, LogEntry } from "@keylow/api-client";
import type { BuildLogEntryInput } from "@keylow/core/diary";
import type { Food, FoodPortion } from "@keylow/core/schemas";

import { EditEntryDialog } from "@/components/diary/EditEntryDialog";
import { ToastProvider } from "@/components/ui/Toast";

type Api = {
  entries: LogEntry[];
  /** The food as it is now: null when it cannot be read, deleted when it has a `deleted_at`. */
  food: Food | null;
  /** The food's portions as it has them now; undefined while they are not loaded. */
  portions: FoodPortion[] | undefined;
  updateEntry: {
    mutateAsync: ReturnType<typeof vi.fn<(update: EntryUpdate) => Promise<LogEntry>>>;
  };
};

const api = vi.hoisted((): Api => ({
  entries: [],
  food: null,
  portions: undefined,
  updateEntry: { mutateAsync: vi.fn<(update: EntryUpdate) => Promise<LogEntry>>() },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "UTC" }),
  useDiaryDay: (date: string) => ({ data: diaryDay(date, api.entries) }),
  useFood: () => ({ data: api.food }),
  // Idle, as the real hook is, until it is given a food.
  useFoodPortions: (foodId: string | undefined) => ({
    data: foodId === undefined ? undefined : api.portions,
  }),
  useUpdateEntry: () => api.updateEntry,
  useDeleteEntry: () => ({ mutateAsync: () => Promise.resolve() }),
  useRestoreEntry: () => ({ mutateAsync: () => Promise.resolve() }),
}));

const TODAY = "2026-10-15";
const tablespoon = { id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: 15 };
const cup = { id: "spoon-cup", label: "1 cup", grams: null, ml: 240 };

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
  const onClose = vi.fn<() => void>();
  render(
    <ToastProvider>
      <EditEntryDialog entryId={entry.id} date={TODAY} opener={null} onClose={onClose} />
    </ToastProvider>,
  );

  return { onClose };
}

const chipNames = () => screen.getAllByRole("radio").map((chip) => chip.textContent);
const amountField = (unit: string) => screen.getByRole("textbox", { name: `Amount (${unit})` });
const save = () => {
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
};

beforeEach(() => {
  api.food = oliveOil.food;
  api.portions = undefined;
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

      expect(chipNames()).toEqual(["g", "ml", "1 tsp", "1 tbsp", "1 cup"]);
      expect(screen.getAllByRole("radio", { name: "1 tbsp" })).toHaveLength(1);
      expect(screen.getByRole("radio", { name: "1 tbsp", checked: true })).toBeTruthy();
    });

    it("should open an entry logged in 2 cups on the cup chip, selected, with the count and its volume", () => {
      renderDialog(oilEntry({ quantity: 2, unit: "portion", portion: cup }));

      expect(chipNames()).toEqual(["g", "ml", "1 tsp", "1 tbsp", "1 cup"]);
      expect(screen.getByRole("radio", { name: "1 cup", checked: true })).toBeTruthy();
      expect(amountField("cups")).toHaveProperty("value", "2");
      expect(
        screen.getByRole("group", { name: "Energy and macros, For 2 cups (480 ml, 442 g)" }),
      ).toBeTruthy();
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
      expect(chipNames()).toEqual(["g", "ml", "1 tsp", "1 tbsp", "1 cup"]);

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

    function bananaEntry(): LogEntry {
      return foodEntry({
        date: TODAY,
        time: "12:40",
        name: "Banana",
        quantity: 1,
        unit: "portion",
        kcal: 95,
        protein: 1.2,
        fat: 0.1,
        carbs: 20.3,
      });
    }

    it("should save a changed count of its own portion with no portion in the change, so the link is kept", async () => {
      const entry = bananaEntry();
      renderDialog(entry);

      fireEvent.change(amountField("medium"), { target: { value: "2" } });
      save();

      await waitFor(() => {
        expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledWith({
        entry,
        amount: { quantity: 2, unit: "portion" },
      });
    });

    it("should show its portion then grams, and no spoon, for an entry logged in a portion", () => {
      renderDialog(bananaEntry());

      expect(chipNames()).toEqual(["1 medium", "g"]);
      expect(screen.getByRole("radio", { name: "1 medium", checked: true })).toBeTruthy();
    });
  });
});

describe("the edit dialog's chips for a food that stores a 1 tbsp portion", () => {
  const storedTablespoon = buildFoodPortion({
    food_id: oliveOil.food.id,
    label: "1 tbsp",
    grams: 14,
    is_default: true,
  });

  beforeEach(() => {
    api.portions = [storedTablespoon];
  });

  it("should show one 1 tbsp chip, selected, with the count, for an entry logged in tablespoons", () => {
    renderDialog(oilEntry({ quantity: 2, unit: "portion", portion: tablespoon }));

    expect(chipNames()).toEqual(["g", "ml", "1 tsp", "1 tbsp", "1 cup"]);
    expect(screen.getAllByRole("radio", { name: "1 tbsp" })).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "1 tbsp", checked: true })).toBeTruthy();
    expect(amountField("tbsp")).toHaveProperty("value", "2");
  });

  it("should show one 1 tbsp chip, the stored one, for an entry logged in grams", () => {
    renderDialog(oilEntry({ quantity: 20, unit: "g" }));

    expect(chipNames()).toEqual(["1 tbsp", "g", "ml", "1 tsp", "1 cup"]);
    expect(screen.getAllByRole("radio", { name: "1 tbsp" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("radio", { name: "1 tbsp" }));

    expect(
      screen.getByRole("group", { name: "Energy and macros, For 1 tbsp (14 g)" }),
    ).toBeTruthy();
  });
});

describe("pressing a different chip in the edit dialog", () => {
  it("should open an entry on its own amount, before any chip is pressed", () => {
    renderDialog(oilEntry({ quantity: 20, unit: "g" }));

    expect(amountField("g")).toHaveProperty("value", "20");
  });

  it("should set an entry logged in grams to 1 when 1 tbsp is pressed, not read 20 tbsp", () => {
    renderDialog(oilEntry({ quantity: 20, unit: "g" }));

    fireEvent.click(screen.getByRole("radio", { name: "1 tbsp" }));

    expect(amountField("tbsp")).toHaveProperty("value", "1");
    expect(
      screen.getByRole("group", { name: "Energy and macros, For 1 tbsp (15 ml, 14 g)" }),
    ).toBeTruthy();
  });

  it("should set an entry logged in a portion to 100 when g is pressed, not read 2 g", () => {
    renderDialog(
      foodEntry({
        date: TODAY,
        time: "12:40",
        name: "Banana",
        quantity: 2,
        unit: "portion",
        kcal: 95,
        protein: 1.2,
        fat: 0.1,
        carbs: 20.3,
      }),
    );

    fireEvent.click(screen.getByRole("radio", { name: "g" }));

    expect(amountField("g")).toHaveProperty("value", "100");
    expect(screen.getByRole("group", { name: "Energy and macros, For 100 g" })).toBeTruthy();
  });

  it("should keep the amount when the chip already chosen is pressed", () => {
    renderDialog(oilEntry({ quantity: 20, unit: "g" }));

    fireEvent.click(screen.getByRole("radio", { name: "g" }));

    expect(amountField("g")).toHaveProperty("value", "20");
  });

  it("should save the amount the chip set", async () => {
    const entry = oilEntry({ quantity: 20, unit: "g" });
    renderDialog(entry);

    fireEvent.click(screen.getByRole("radio", { name: "1 tsp" }));
    save();

    await waitFor(() => {
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
    });
    expect(api.updateEntry.mutateAsync).toHaveBeenCalledWith({
      entry,
      amount: { quantity: 1, unit: "portion", portion: { label: "1 tsp", ml: 5 } },
    });
  });
});

describe("the edit dialog's chips for a food that has portions", () => {
  const [small, medium, large] = banana.portions;
  if (small === undefined || medium === undefined || large === undefined) {
    throw new Error("The banana must have a small, a medium and a large portion");
  }
  // The food has other numbers now than the entry was logged with: the entry keeps its own.
  const bananaNow = { ...banana.food, kcal: 999 };

  beforeEach(() => {
    api.food = bananaNow;
    api.portions = [large, small, medium];
  });

  const loggedAsGrams = () => oilEntry({ quantity: 120, unit: "g" }, banana.food);
  const loggedAsMedium = (quantity = 1) =>
    oilEntry({ quantity, unit: "portion", portion: medium }, banana.food);

  it("should offer the portions in position order, then g, for an entry logged in grams, with g chosen", () => {
    renderDialog(loggedAsGrams());

    expect(chipNames()).toEqual(["1 small", "1 medium", "1 large", "g"]);
    expect(screen.getByRole("radio", { name: "g", checked: true })).toBeTruthy();
    expect(amountField("g")).toHaveProperty("value", "120");
  });

  it("should save the portion's id, label and grams when a portion is chosen", async () => {
    const entry = loggedAsGrams();
    renderDialog(entry);

    fireEvent.click(screen.getByRole("radio", { name: "1 medium" }));

    expect(amountField("medium")).toHaveProperty("value", "1");
    expect(
      screen.getByRole("group", { name: "Energy and macros, For 1 medium (118 g)" }),
    ).toBeTruthy();
    save();
    await waitFor(() => {
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
    });
    expect(api.updateEntry.mutateAsync).toHaveBeenCalledWith({
      entry,
      amount: {
        quantity: 1,
        unit: "portion",
        portion: { label: "1 medium", grams: 118 },
        portionId: medium.id,
      },
    });
  });

  it("should work the chosen portion out from the entry's own values, not the food's now", () => {
    renderDialog(loggedAsGrams());

    fireEvent.click(screen.getByRole("radio", { name: "1 large" }));

    const hero = screen.getByRole("group", { name: "Energy and macros, For 1 large (136 g)" });
    // 81 kcal per 100 g as logged: 136 g is 110, where the food's 999 would give 1,359.
    expect(within(hero).getByText("110")).toBeTruthy();
  });

  it("should switch an entry logged as 1 medium to 1 large", async () => {
    const entry = loggedAsMedium();
    renderDialog(entry);
    expect(screen.getAllByRole("radio", { name: "1 medium" })).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "1 medium", checked: true })).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "1 large" }));
    save();

    await waitFor(() => {
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
    });
    expect(api.updateEntry.mutateAsync).toHaveBeenCalledWith({
      entry,
      amount: {
        quantity: 1,
        unit: "portion",
        portion: { label: "1 large", grams: 136 },
        portionId: large.id,
      },
    });
  });

  it("should keep the entry's own portion, with its link, when only the count of it changes", async () => {
    const entry = loggedAsMedium();
    renderDialog(entry);

    fireEvent.change(amountField("medium"), { target: { value: "2" } });
    save();

    await waitFor(() => {
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
    });
    expect(api.updateEntry.mutateAsync).toHaveBeenCalledWith({
      entry,
      amount: { quantity: 2, unit: "portion" },
    });
  });

  it("should send nothing when an entry logged in grams is saved as it was", async () => {
    const { onClose } = renderDialog(loggedAsGrams());

    save();

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
  });

  it("should send nothing when an entry logged in a portion is saved as it was", async () => {
    const { onClose } = renderDialog(loggedAsMedium(2));

    save();

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(api.updateEntry.mutateAsync).not.toHaveBeenCalled();
  });

  it("should show the portion the entry was logged with once, among the food's, when the food has lost it", () => {
    api.portions = [small, large];
    renderDialog(loggedAsMedium());

    expect(chipNames()).toEqual(["1 medium", "1 small", "1 large", "g"]);
    expect(screen.getByRole("radio", { name: "1 medium", checked: true })).toBeTruthy();
  });

  it("should offer the entry's own chips while the food's portions are loading", () => {
    api.portions = undefined;
    renderDialog(loggedAsGrams());

    expect(chipNames()).toEqual(["g"]);
  });

  it("should offer the entry's own chips, and still save, when the food has been deleted", async () => {
    api.food = { ...bananaNow, deleted_at: "2026-10-15T13:00:00+00:00" };
    const entry = loggedAsGrams();
    renderDialog(entry);

    expect(chipNames()).toEqual(["g"]);
    fireEvent.change(amountField("g"), { target: { value: "200" } });
    save();
    await waitFor(() => {
      expect(api.updateEntry.mutateAsync).toHaveBeenCalledOnce();
    });
    expect(api.updateEntry.mutateAsync).toHaveBeenCalledWith({
      entry,
      amount: { quantity: 200, unit: "g" },
    });
  });

  it("should offer the entry's own chips when the food cannot be read", () => {
    api.food = null;
    renderDialog(loggedAsGrams());

    expect(chipNames()).toEqual(["g"]);
  });
});

describe("pressing a chip in the edit dialog puts the cursor in the amount with the whole number selected", () => {
  it("should still put the cursor in the amount when the dialog opens, through the ref it hands the fields", () => {
    renderDialog(oilEntry({ quantity: 20, unit: "g" }));

    expect(document.activeElement).toBe(amountField("g"));
  });

  it("should select the new unit's starting amount", () => {
    renderDialog(oilEntry({ quantity: 20, unit: "g" }));

    fireEvent.click(screen.getByRole("radio", { name: "1 tbsp" }));

    const field = amountField("tbsp");
    expect(document.activeElement).toBe(field);
    expect(field).toHaveProperty("value", "1");
    expect(field).toHaveProperty("selectionStart", 0);
    expect(field).toHaveProperty("selectionEnd", 1);
  });

  it("should select the amount again when the chip already chosen is pressed", () => {
    renderDialog(oilEntry({ quantity: 20, unit: "g" }));

    fireEvent.click(screen.getByRole("radio", { name: "g" }));

    const field = amountField("g");
    expect(document.activeElement).toBe(field);
    expect(field).toHaveProperty("selectionStart", 0);
    expect(field).toHaveProperty("selectionEnd", 2);
  });

  it("should keep the focus in the chips when an arrow key walks them", () => {
    renderDialog(oilEntry({ quantity: 20, unit: "g" }));

    fireEvent.keyDown(screen.getByRole("radio", { name: "g" }), { key: "ArrowRight" });

    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "ml" }));
  });
});

describe("clicking into the amount in the edit dialog selects the whole number", () => {
  it("should select the number when the dialog opens", () => {
    renderDialog(oilEntry({ quantity: 20, unit: "g" }));

    const field = amountField("g");
    expect(field).toHaveProperty("selectionStart", 0);
    expect(field).toHaveProperty("selectionEnd", 2);
  });

  it("should select the number and keep it selected through the mouseup of a click that gave the field focus", () => {
    renderDialog(oilEntry({ quantity: 20, unit: "g" }));
    screen.getByRole("radio", { name: "ml" }).focus();
    const field = amountField("g");

    fireEvent.mouseDown(field);
    field.focus();
    const mouseUpWasNotPrevented = fireEvent.mouseUp(field);

    expect(field).toHaveProperty("selectionStart", 0);
    expect(field).toHaveProperty("selectionEnd", 2);
    expect(mouseUpWasNotPrevented).toBe(false);
  });

  it("should not stop the mouseup of a click on a field that already has focus", () => {
    renderDialog(oilEntry({ quantity: 20, unit: "g" }));
    const field = amountField("g");
    field.focus();

    fireEvent.mouseDown(field);

    expect(fireEvent.mouseUp(field)).toBe(true);
  });

  it("should select the whole number when the field gets focus from the keyboard alone", () => {
    renderDialog(oilEntry({ quantity: 20, unit: "g" }));
    screen.getByRole("radio", { name: "ml" }).focus();

    amountField("g").focus();

    expect(amountField("g")).toHaveProperty("selectionStart", 0);
    expect(amountField("g")).toHaveProperty("selectionEnd", 2);
  });
});
