import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { foodEntry } from "./support";
import { makeFood, makePortion, makeSearchHit } from "../foods/support";

import type { AddFoodRequest } from "@/lib/foodLogActions";
import type { LogFoodInput, FoodSearchHit, LogEntry } from "@keylow/api-client";
import type { Food, FoodPortion } from "@keylow/core/schemas";

import { AddFoodDialog } from "@/components/diary/AddFoodDialog";
import { ToastProvider } from "@/components/ui/Toast";

const CHICKEN_ID = "11111111-1111-4111-8111-111111111111";
const RICE_ID = "11111111-1111-4111-8111-222222222222";
const SOUP_ID = "11111111-1111-4111-8111-333333333333";
const KETCHUP_ID = "11111111-1111-4111-8111-444444444444";

const chicken = makeFood({
  id: CHICKEN_ID,
  name: "Chicken breast, grilled",
  source: "cofid",
  kcal: 148,
  protein_g: 32,
  carbs_g: 0,
  fat_g: 2.2,
});
const breast = makePortion({
  id: "22222222-2222-4222-8222-111111111111",
  food_id: CHICKEN_ID,
  label: "1 breast",
  grams: 150,
  is_default: true,
});
const rice = makeFood({
  id: RICE_ID,
  name: "Basmati rice, boiled",
  source: "cofid",
  kcal: 120,
  protein_g: 2.7,
  carbs_g: 26,
  fat_g: 0.4,
});
const soup = makeFood({
  id: SOUP_ID,
  name: "Chicken soup, canned",
  source: "cofid",
  kcal: 48,
  protein_g: 2.4,
  carbs_g: 5,
  fat_g: null,
});

function hitOf(food: Food, portion?: FoodPortion): FoodSearchHit {
  return makeSearchHit({
    id: food.id,
    name: food.name,
    source: food.source,
    kcal: food.kcal,
    protein_g: food.protein_g,
    fat_g: food.fat_g,
    carbs_g: food.carbs_g,
    quality: food.quality,
    default_portion_id: portion?.id ?? null,
    default_portion_label: portion?.label ?? null,
    default_portion_grams: portion?.grams ?? null,
    default_portion_ml: portion?.ml ?? null,
  });
}

type Api = {
  timeZone: string;
  hits: FoodSearchHit[];
  searchError: boolean;
  searchQueries: string[];
  foods: Map<string, Food>;
  portions: Map<string, FoodPortion[]>;
  stored: LogEntry[];
  logFood: { mutateAsync: ReturnType<typeof vi.fn<(input: LogFoodInput) => Promise<LogEntry>>> };
  deleteEntry: { mutateAsync: ReturnType<typeof vi.fn<(entry: LogEntry) => Promise<void>>> };
};

const api = vi.hoisted((): Api => ({
  timeZone: "UTC",
  hits: [],
  searchError: false,
  searchQueries: [],
  foods: new Map(),
  portions: new Map(),
  stored: [],
  logFood: { mutateAsync: undefined as never },
  deleteEntry: { mutateAsync: undefined as never },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: api.timeZone }),
  useFoodSearch: (query: string) => {
    api.searchQueries.push(query);
    return {
      local: query.trim().length >= 2 ? api.hits : [],
      off: [],
      isLoadingLocal: false,
      isLoadingOff: false,
      isDebouncing: false,
      offError: null,
      localError: api.searchError ? { kind: "failed", debugMessage: "RAW SEARCH FAILURE" } : null,
    };
  },
  // The recipes are the recipes tests' business: here the search finds nothing and nothing is logged.
  useRecipeSearch: () => ({ recipes: [], isLoading: false, isDebouncing: false, error: null }),
  useLogRecipeServing: () => ({ mutateAsync: () => Promise.reject(new Error("not used")) }),
  useFoodWithPortions: (id: string) => {
    const food = api.foods.get(id);
    return food === undefined
      ? { status: "notFound" }
      : { status: "ready", food, portions: api.portions.get(id) ?? [] };
  },
  useLogFood: () => api.logFood,
  useDeleteEntry: () => api.deleteEntry,
  useSupabase: () => ({}),
  getFood: (_client: unknown, id: string) => Promise.resolve(api.foods.get(id) ?? null),
  listFoodPortions: (_client: unknown, id: string) => Promise.resolve(api.portions.get(id) ?? []),
}));

// 12:40 on Thursday 15 October 2026 in UTC, so "now" is 12:40.
const NOW = new Date("2026-10-15T12:40:30Z");

function entryFor(input: LogFoodInput): LogEntry {
  const stored = foodEntry({
    date: input.localDate,
    time: "12:00",
    name: input.food.name,
    quantity: input.quantity,
    unit: input.unit === "portion" ? "portion" : input.unit === "ml" ? "ml" : "g",
    kcal: 1,
    protein: 1,
    fat: 1,
    carbs: 1,
  });
  api.stored.push(stored);
  return stored;
}

function renderDialog(request: AddFoodRequest = { date: "2026-10-15" }) {
  const onClose = vi.fn<() => void>();
  const onQuickAdd = vi.fn<() => void>();
  render(
    <ToastProvider>
      <button type="button">Add food at 12:00</button>
      <AddFoodDialog request={request} opener={null} onClose={onClose} onQuickAdd={onQuickAdd} />
    </ToastProvider>,
  );

  return { onClose, onQuickAdd };
}

function search(text: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
    target: { value: text },
  });
}

const dialog = () => screen.getByRole("dialog", { name: "Add food" });
const results = () => within(screen.getByRole("group", { name: "Search results" }));
const addButton = (name: string) => screen.getByRole("button", { name });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  api.timeZone = "UTC";
  api.hits = [hitOf(chicken, breast), hitOf(rice), hitOf(soup)];
  api.searchError = false;
  api.searchQueries = [];
  api.foods = new Map([
    [CHICKEN_ID, chicken],
    [RICE_ID, rice],
    [SOUP_ID, soup],
  ]);
  api.portions = new Map([[CHICKEN_ID, [breast]]]);
  api.stored = [];
  api.logFood.mutateAsync = vi.fn((input: LogFoodInput) => Promise.resolve(entryFor(input)));
  api.deleteEntry.mutateAsync = vi.fn(() => Promise.resolve());
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe("the add food dialog", () => {
  describe("opening", () => {
    it("should be a dialog titled Add food with the cursor in the search field", () => {
      renderDialog();

      expect(dialog()).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Search foods" }));
    });

    it("should hint at what to type until there is something to search for", () => {
      renderDialog();

      expect(screen.getByText("Type at least 2 characters to search")).toBeTruthy();
    });

    it("should have a compact Time field beside the search, reading now from the top bar", () => {
      renderDialog();

      expect(screen.getByRole("button", { name: "Time, now, 12:40, change" })).toBeTruthy();
    });

    it("should read the hour an hour's plus asked for, and not now", () => {
      renderDialog({ date: "2026-10-15", time: "12:00" });

      expect(screen.getByRole("button", { name: "Time, 12:00, change" })).toBeTruthy();
    });

    it("should read the current clock time on a past day", () => {
      renderDialog({ date: "2026-10-14" });

      expect(screen.getByRole("button", { name: "Time, now, 12:40, change" })).toBeTruthy();
    });

    it("should open on today, with the Time field reading now, when the request names no day", () => {
      api.timeZone = "Pacific/Auckland";
      renderDialog({});

      // 12:40 UTC is 01:40 on the 16th in Auckland, which is 13 hours ahead in October.
      expect(screen.getByRole("button", { name: "Time, now, 01:40, change" })).toBeTruthy();
    });

    it("should close on Cancel, and Escape", () => {
      const { onClose } = renderDialog();

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("should search only the foods in the database, never Open Food Facts", () => {
      renderDialog();

      search("chicken");

      expect(api.searchQueries).toContain("chicken");
    });
  });

  describe("the Quick add row", () => {
    it("should be offered before anything is typed, with its caption", () => {
      renderDialog();

      expect(screen.getByRole("button", { name: /Quick add/ }).textContent).toContain(
        "Calories and macros by hand",
      );
    });

    it("should open quick add on a press", () => {
      const { onQuickAdd } = renderDialog({ date: "2026-10-15", time: "12:00" });

      fireEvent.click(screen.getByRole("button", { name: /Quick add/ }));

      expect(onQuickAdd).toHaveBeenCalledOnce();
    });

    it("should give way to the results once something is typed", () => {
      renderDialog();

      search("chicken");

      expect(screen.queryByRole("button", { name: /Quick add/ })).toBeNull();
    });
  });

  describe("the rows", () => {
    it("should show each food with its serving and the values for that serving", () => {
      renderDialog();

      search("chicken");

      const row = results().getByRole("button", { name: /^Chicken\s*breast,\s*grilled/ });
      expect(within(row).getByText("1 breast (150 g)")).toBeTruthy();
      expect(within(row).getByText("222")).toBeTruthy();
      expect(row.textContent).toContain("48 P");
    });

    it("should show 100 g for a food with no default portion", () => {
      renderDialog();

      search("rice");

      const row = results().getByRole("button", { name: /^Basmati\s*rice,\s*boiled/ });
      expect(within(row).getByText("100 g")).toBeTruthy();
      expect(within(row).getByText("120")).toBeTruthy();
    });

    it("should keep the order the database ranked them in", () => {
      api.hits = [hitOf(rice), hitOf(chicken, breast)];
      renderDialog();

      search("rice");

      expect(
        results()
          .getAllByRole("button", { name: /^Add / })
          .map((button) => button.getAttribute("aria-label")),
      ).toEqual([
        "Add Basmati rice, boiled, 100 g",
        "Add Chicken breast, grilled, 1 breast (150 g)",
      ]);
    });

    it("should name each plus for the food and its serving", () => {
      renderDialog();

      search("chicken");

      expect(addButton("Add Chicken breast, grilled, 1 breast (150 g)")).toBeTruthy();
    });

    it("should show Needs review and a chevron, and no plus, for a food missing a macro", () => {
      renderDialog();

      search("soup");

      expect(results().getByText("Needs review")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Add Chicken soup/ })).toBeNull();
      expect(results().getByRole("button", { name: /^Chicken\s*soup,\s*canned/ })).toBeTruthy();
    });

    it("should say so when nothing was found", () => {
      api.hits = [];
      renderDialog();

      search("zzz");

      expect(screen.getByText("No foods found")).toBeTruthy();
    });

    it("should say the search failed in its own words, never the raw failure", () => {
      api.searchError = true;
      renderDialog();

      search("chicken");

      expect(screen.getByText("Search failed")).toBeTruthy();
      expect(screen.queryByText(/RAW SEARCH FAILURE/)).toBeNull();
    });
  });

  describe("the plus on a row", () => {
    it("should log that serving at once, at the hour an hour's plus asked for", async () => {
      renderDialog({ date: "2026-10-15", time: "12:00" });
      search("chicken");

      fireEvent.click(addButton("Add Chicken breast, grilled, 1 breast (150 g)"));

      await waitFor(() => {
        expect(api.logFood.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.logFood.mutateAsync).toHaveBeenCalledWith({
        food: chicken,
        quantity: 1,
        unit: "portion",
        portion: breast,
        foodPortions: [breast],
        loggedAt: "2026-10-15T12:00:00.000Z",
        localDate: "2026-10-15",
      });
    });

    it("should log 100 g of a food with no portion, at now when the dialog was opened from the top bar", async () => {
      renderDialog();
      search("rice");

      fireEvent.click(addButton("Add Basmati rice, boiled, 100 g"));

      await waitFor(() => {
        expect(api.logFood.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.logFood.mutateAsync).toHaveBeenCalledWith({
        food: rice,
        quantity: 100,
        unit: "g",
        foodPortions: [],
        loggedAt: "2026-10-15T12:40:30.000Z",
        localDate: "2026-10-15",
      });
    });

    it("should log on the day the dialog was opened for, at the current clock time", async () => {
      renderDialog({ date: "2026-10-14" });
      search("rice");

      fireEvent.click(addButton("Add Basmati rice, boiled, 100 g"));

      await waitFor(() => {
        expect(api.logFood.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.logFood.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ loggedAt: "2026-10-14T12:40:00.000Z", localDate: "2026-10-14" }),
      );
    });

    it("should log now, today in the profile's zone, when the request names no day", async () => {
      api.timeZone = "Pacific/Auckland";
      renderDialog({});
      search("rice");

      fireEvent.click(addButton("Add Basmati rice, boiled, 100 g"));

      await waitFor(() => {
        expect(api.logFood.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.logFood.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ loggedAt: "2026-10-15T12:40:30.000Z", localDate: "2026-10-16" }),
      );
    });

    it("should log at the time chosen in the Time field", async () => {
      renderDialog();
      fireEvent.click(screen.getByRole("button", { name: "Time, now, 12:40, change" }));
      fireEvent.click(
        within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "08" }),
      );
      fireEvent.click(
        within(screen.getByRole("listbox", { name: "Minutes" })).getByRole("option", {
          name: "30",
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Done" }));
      search("rice");

      fireEvent.click(addButton("Add Basmati rice, boiled, 100 g"));

      await waitFor(() => {
        expect(api.logFood.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.logFood.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ loggedAt: "2026-10-15T08:30:00.000Z", localDate: "2026-10-15" }),
      );
      expect(screen.getByRole("button", { name: "Time, 08:30, change" })).toBeTruthy();
    });

    it("should read the time in the profile's zone", async () => {
      api.timeZone = "Europe/London";
      renderDialog({ date: "2026-10-15", time: "12:00" });
      search("rice");

      fireEvent.click(addButton("Add Basmati rice, boiled, 100 g"));

      await waitFor(() => {
        expect(api.logFood.mutateAsync).toHaveBeenCalledOnce();
      });
      // 12:00 in London in October is 11:00 UTC, because the clocks are still on summer time.
      expect(api.logFood.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ loggedAt: "2026-10-15T11:00:00.000Z" }),
      );
    });

    it("should give a keyboard press the route to Undo: focus goes to it, and comes back to the plus", async () => {
      renderDialog({ date: "2026-10-15", time: "12:00" });
      search("rice");
      const plus = addButton("Add Basmati rice, boiled, 100 g");
      fireEvent.keyDown(document, { key: "Enter" });
      plus.focus();

      fireEvent.click(plus);
      await screen.findByText("Added Basmati rice, boiled");

      // The toast commits first and moves focus to Undo in an effect, so focus is waited for.
      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Undo" }));
      });

      fireEvent.keyDown(screen.getByRole("button", { name: "Undo" }), { key: "Escape" });

      expect(document.activeElement).toBe(plus);
    });

    it("should keep the dialog open when Escape dismisses the toast", async () => {
      const { onClose } = renderDialog({ date: "2026-10-15", time: "12:00" });
      search("rice");
      const plus = addButton("Add Basmati rice, boiled, 100 g");
      fireEvent.keyDown(document, { key: "Enter" });
      plus.focus();
      fireEvent.click(plus);
      await screen.findByText("Added Basmati rice, boiled");

      fireEvent.keyDown(screen.getByRole("button", { name: "Undo" }), { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("should leave focus where it is after a pointer press", async () => {
      renderDialog({ date: "2026-10-15", time: "12:00" });
      search("rice");
      const plus = addButton("Add Basmati rice, boiled, 100 g");
      fireEvent.pointerDown(plus);
      plus.focus();

      fireEvent.click(plus, { detail: 1 });
      await screen.findByText("Added Basmati rice, boiled");

      expect(document.activeElement).toBe(plus);
    });

    it("should say Added with the food's name and leave the dialog open", async () => {
      const { onClose } = renderDialog({ date: "2026-10-15", time: "12:00" });
      search("chicken");

      fireEvent.click(addButton("Add Chicken breast, grilled, 1 breast (150 g)"));

      expect(await screen.findByText("Added Chicken breast, grilled")).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
      expect(dialog()).toBeTruthy();
    });

    it("should let several foods be added in a row", async () => {
      renderDialog({ date: "2026-10-15", time: "12:00" });
      search("chicken");

      fireEvent.click(addButton("Add Chicken breast, grilled, 1 breast (150 g)"));
      await screen.findByText("Added Chicken breast, grilled");
      fireEvent.click(addButton("Add Basmati rice, boiled, 100 g"));

      expect(await screen.findByText("Added Basmati rice, boiled")).toBeTruthy();
      expect(api.logFood.mutateAsync).toHaveBeenCalledTimes(2);
    });

    it("should log a double press once", async () => {
      renderDialog({ date: "2026-10-15", time: "12:00" });
      search("rice");
      const plus = addButton("Add Basmati rice, boiled, 100 g");

      fireEvent.click(plus);
      fireEvent.click(plus);

      await screen.findByText("Added Basmati rice, boiled");
      expect(api.logFood.mutateAsync).toHaveBeenCalledOnce();
    });

    it("should undo only the entry that its own toast logged", async () => {
      renderDialog({ date: "2026-10-15", time: "12:00" });
      search("chicken");
      fireEvent.click(addButton("Add Chicken breast, grilled, 1 breast (150 g)"));
      await screen.findByText("Added Chicken breast, grilled");
      fireEvent.click(addButton("Add Basmati rice, boiled, 100 g"));
      await screen.findByText("Added Basmati rice, boiled");

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      expect(api.deleteEntry.mutateAsync).toHaveBeenCalledExactlyOnceWith(api.stored[1]);
    });

    it("should say that it could not undo, and not that the entry was kept", async () => {
      api.deleteEntry.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW")));
      renderDialog({ date: "2026-10-15", time: "12:00" });
      search("rice");
      fireEvent.click(addButton("Add Basmati rice, boiled, 100 g"));
      await screen.findByText("Added Basmati rice, boiled");

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      expect(await screen.findByText("Couldn't undo. Try again.")).toBeTruthy();
    });

    it("should say it was not saved, without the raw failure or the amount, when the log fails", async () => {
      api.logFood.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW 150 g failure")));
      renderDialog({ date: "2026-10-15", time: "12:00" });
      search("chicken");

      fireEvent.click(addButton("Add Chicken breast, grilled, 1 breast (150 g)"));

      expect(
        await screen.findByText("Not saved. Check your connection and try again."),
      ).toBeTruthy();
      expect(screen.queryByText(/RAW/)).toBeNull();
      expect(screen.queryByText(/Added/)).toBeNull();
    });
  });

  describe("the portion step", () => {
    function openChicken() {
      renderDialog();
      search("chicken");
      fireEvent.click(results().getByRole("button", { name: /^Chicken\s*breast,\s*grilled/ }));
    }

    it("should open on a press on the row, with a Results link back", () => {
      openChicken();

      expect(screen.getByRole("button", { name: "Results" })).toBeTruthy();
      expect(screen.queryByRole("searchbox")).toBeNull();
      expect(dialog()).toBeTruthy();
    });

    it("should start at the food's serving: one portion, and the cursor in the amount", () => {
      openChicken();

      const amount = screen.getByRole("textbox", { name: /^Amount/ });
      expect(amount).toHaveProperty("value", "1");
      expect(document.activeElement).toBe(amount);
      expect(screen.getByRole("radio", { name: "1 breast", checked: true })).toBeTruthy();
    });

    it("should show the hero for the serving, with the food's name", () => {
      openChicken();

      const hero = screen.getByRole("group", { name: "Energy and macros, For 1 breast (150 g)" });
      expect(within(hero).getByText("Chicken breast, grilled")).toBeTruthy();
      expect(within(hero).getByText("222")).toBeTruthy();
    });

    it("should say Now under the Time field, which reads the time the dialog opened", () => {
      openChicken();

      expect(screen.getByRole("button", { name: "Time 12:40" })).toBeTruthy();
      expect(screen.getByText("Now")).toBeTruthy();
    });

    it("should say nothing about Now when the dialog was opened from an hour's plus", () => {
      renderDialog({ date: "2026-10-15", time: "12:00" });
      search("chicken");
      fireEvent.click(results().getByRole("button", { name: /^Chicken\s*breast,\s*grilled/ }));

      expect(screen.getByRole("button", { name: "Time 12:00" })).toBeTruthy();
      expect(screen.queryByText("Now")).toBeNull();
    });

    it("should work out the hero again for a new amount in grams", () => {
      openChicken();

      fireEvent.click(screen.getByRole("radio", { name: "g" }));
      fireEvent.change(screen.getByRole("textbox", { name: /^Amount/ }), {
        target: { value: "200" },
      });

      const hero = screen.getByRole("group", { name: "Energy and macros, For 200 g" });
      expect(within(hero).getByText("296")).toBeTruthy();
    });

    it("should show dashes and an error, and not allow Add, for an amount that is not above 0", () => {
      openChicken();

      fireEvent.change(screen.getByRole("textbox", { name: /^Amount/ }), {
        target: { value: "0" },
      });

      expect(screen.getByText("Enter an amount above 0.")).toBeTruthy();
      expect(
        screen.getByRole("group", { name: "Energy and macros, For this amount" }),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Add" })).toHaveProperty("disabled", true);
    });

    it("should log the amount at the Time field's time on Add, close the dialog and say Added", async () => {
      const { onClose } = renderDialog();
      search("chicken");
      fireEvent.click(results().getByRole("button", { name: /^Chicken\s*breast,\s*grilled/ }));
      fireEvent.click(screen.getByRole("radio", { name: "g" }));
      fireEvent.change(screen.getByRole("textbox", { name: /^Amount/ }), {
        target: { value: "200" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.logFood.mutateAsync).toHaveBeenCalledExactlyOnceWith({
        food: chicken,
        quantity: 200,
        unit: "g",
        foodPortions: [breast],
        loggedAt: "2026-10-15T12:40:30.000Z",
        localDate: "2026-10-15",
      });
      expect(await screen.findByText("Added")).toBeTruthy();
    });

    it("should log the time chosen in the Time field", async () => {
      openChicken();
      fireEvent.click(screen.getByRole("button", { name: "Time 12:40" }));
      fireEvent.click(
        within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "19" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        expect(api.logFood.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.logFood.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ loggedAt: "2026-10-15T19:40:00.000Z" }),
      );
      expect(screen.queryByText("Now")).toBeNull();
    });

    it("should stay open with a banner when the log fails, and keep what was typed", async () => {
      api.logFood.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW 150 g failure")));
      const { onClose } = renderDialog();
      search("chicken");
      fireEvent.click(results().getByRole("button", { name: /^Chicken\s*breast,\s*grilled/ }));

      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      expect(
        await screen.findByText("Not saved. Check your connection and try again."),
      ).toBeTruthy();
      expect(screen.queryByText(/RAW/)).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("textbox", { name: /^Amount/ })).toHaveProperty("value", "1");
    });

    it("should go back to the results with what was typed, and the cursor in the search", () => {
      openChicken();

      fireEvent.click(screen.getByRole("button", { name: "Results" }));

      const field = screen.getByRole("searchbox", { name: "Search foods" });
      expect(field).toHaveProperty("value", "chicken");
      expect(document.activeElement).toBe(field);
      expect(addButton("Add Chicken breast, grilled, 1 breast (150 g)")).toBeTruthy();
    });

    it("should keep the time chosen in the search when a food is opened", () => {
      renderDialog();
      fireEvent.click(screen.getByRole("button", { name: "Time, now, 12:40, change" }));
      fireEvent.click(
        within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "09" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Done" }));
      search("chicken");

      fireEvent.click(results().getByRole("button", { name: /^Chicken\s*breast,\s*grilled/ }));

      expect(screen.getByRole("button", { name: "Time 09:40" })).toBeTruthy();
    });

    it("should say a food that needs review has to be copied first, and not allow Add", () => {
      renderDialog();
      search("soup");
      fireEvent.click(results().getByRole("button", { name: /^Chicken\s*soup,\s*canned/ }));

      expect(screen.getByText("Needs review")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Copy to your foods" }).getAttribute("href")).toBe(
        `/foods/new?from=${SOUP_ID}`,
      );
      expect(screen.getByRole("button", { name: "Add" })).toHaveProperty("disabled", true);
    });

    it("should say the food is not found when it cannot be read", () => {
      api.foods.delete(CHICKEN_ID);
      openChicken();

      expect(screen.getByText("Food not found")).toBeTruthy();
    });
  });

  describe("opening on a food", () => {
    it("should open on that food's portion step, with no search step first", () => {
      renderDialog({ foodId: CHICKEN_ID });

      expect(screen.getByRole("radio", { name: "1 breast", checked: true })).toBeTruthy();
      expect(screen.getByRole("textbox", { name: /^Amount/ })).toHaveProperty("value", "1");
      expect(screen.queryByRole("searchbox")).toBeNull();
    });

    it("should show one 1 tbsp radio when the food already stores a 1 tbsp portion", () => {
      const ketchup = makeFood({
        id: KETCHUP_ID,
        name: "Tomato ketchup",
        source: "off",
        density_g_per_ml: 1.1,
      });
      api.foods.set(KETCHUP_ID, ketchup);
      api.portions.set(KETCHUP_ID, [
        makePortion({
          id: "22222222-2222-4222-8222-444444444444",
          food_id: KETCHUP_ID,
          label: "1 tbsp",
          grams: 15,
          is_default: true,
        }),
      ]);

      renderDialog({ foodId: KETCHUP_ID });

      expect(screen.getAllByRole("radio", { name: "1 tbsp" })).toHaveLength(1);
      expect(screen.getByRole("radio", { name: "1 tbsp", checked: true })).toBeTruthy();
      expect(screen.getByRole("radio", { name: "1 tsp" })).toBeTruthy();
    });

    it("should read now on today, with the Time field saying Now, when the request names no day", () => {
      renderDialog({ foodId: CHICKEN_ID });

      expect(screen.getByRole("button", { name: "Time 12:40" })).toBeTruthy();
      expect(screen.getByText("Now")).toBeTruthy();
    });

    it("should log the default portion now on today with one press on Add", async () => {
      const { onClose } = renderDialog({ foodId: CHICKEN_ID });

      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.logFood.mutateAsync).toHaveBeenCalledExactlyOnceWith({
        food: chicken,
        quantity: 1,
        unit: "portion",
        portion: breast,
        foodPortions: [breast],
        loggedAt: "2026-10-15T12:40:30.000Z",
        localDate: "2026-10-15",
      });
      expect(await screen.findByText("Added")).toBeTruthy();
    });

    it("should log on the day of the request, at the current clock time", async () => {
      renderDialog({ foodId: CHICKEN_ID, date: "2026-10-14" });

      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        expect(api.logFood.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.logFood.mutateAsync.mock.calls[0]?.[0].localDate).toBe("2026-10-14");
      expect(api.logFood.mutateAsync.mock.calls[0]?.[0].loggedAt).toBe("2026-10-14T12:40:00.000Z");
    });

    it("should go back to the search from the Results link, as on any portion step", () => {
      renderDialog({ foodId: CHICKEN_ID });

      fireEvent.click(screen.getByRole("button", { name: "Results" }));

      expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeTruthy();
    });

    it("should close on Cancel and Escape", () => {
      const { onClose } = renderDialog({ foodId: CHICKEN_ID });

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe("focus", () => {
    it("should keep Tab inside the dialog", () => {
      renderDialog();
      const cancel = screen.getByRole("button", { name: "Cancel" });

      cancel.focus();
      fireEvent.keyDown(cancel, { key: "Tab" });

      expect(dialog().contains(document.activeElement)).toBe(true);
    });

    it("should open the time picker inside the dialog without leaving it", () => {
      renderDialog();

      fireEvent.click(screen.getByRole("button", { name: "Time, now, 12:40, change" }));

      expect(within(dialog()).getByRole("dialog", { name: "Choose a time" })).toBeTruthy();
    });

    it("should let Escape close the picker first and the dialog second", () => {
      const { onClose } = renderDialog();
      fireEvent.click(screen.getByRole("button", { name: "Time, now, 12:40, change" }));

      fireEvent.keyDown(screen.getByRole("listbox", { name: "Hours" }), { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();

      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe("offline", () => {
    const setOnline = (isOnline: boolean) => {
      act(() => {
        onlineManager.setOnline(isOnline);
      });
    };
    const rowPlus = () => addButton("Add Chicken breast, grilled, 1 breast (150 g)");

    it("should disable the plus on a row, and log nothing when it is pressed", () => {
      onlineManager.setOnline(false);
      renderDialog();
      search("chicken");

      fireEvent.click(rowPlus());

      expect(rowPlus().getAttribute("aria-disabled")).toBe("true");
      expect(api.logFood.mutateAsync).not.toHaveBeenCalled();
    });

    it("should leave opening a row alone", () => {
      onlineManager.setOnline(false);
      renderDialog();
      search("chicken");

      fireEvent.click(results().getByRole("button", { name: /^Chicken\s*breast,\s*grilled/ }));

      expect(screen.getByRole("button", { name: "Results" })).toBeTruthy();
    });

    it("should enable the plus again, and log, when the connection returns", async () => {
      onlineManager.setOnline(false);
      renderDialog();
      search("chicken");

      setOnline(true);
      fireEvent.click(rowPlus());

      await waitFor(() => {
        expect(api.logFood.mutateAsync).toHaveBeenCalledOnce();
      });
    });

    it("should disable Add on the portion step, and keep the amount that was typed", () => {
      renderDialog();
      search("chicken");
      fireEvent.click(results().getByRole("button", { name: /^Chicken\s*breast,\s*grilled/ }));
      fireEvent.click(screen.getByRole("radio", { name: "g" }));
      fireEvent.change(screen.getByRole("textbox", { name: /^Amount/ }), {
        target: { value: "200" },
      });

      setOnline(false);
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      expect(screen.getByRole("button", { name: "Add" })).toHaveProperty("disabled", true);
      expect(api.logFood.mutateAsync).not.toHaveBeenCalled();
      expect(screen.getByRole("textbox", { name: /^Amount/ })).toHaveProperty("value", "200");
    });

    it("should add what was typed once the connection returns", async () => {
      const { onClose } = renderDialog();
      search("chicken");
      fireEvent.click(results().getByRole("button", { name: /^Chicken\s*breast,\s*grilled/ }));
      fireEvent.click(screen.getByRole("radio", { name: "g" }));
      fireEvent.change(screen.getByRole("textbox", { name: /^Amount/ }), {
        target: { value: "200" },
      });
      setOnline(false);
      setOnline(true);

      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.logFood.mutateAsync.mock.calls[0]?.[0].quantity).toBe(200);
    });

    it("should leave Cancel alone", () => {
      const { onClose } = renderDialog();
      setOnline(false);

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
