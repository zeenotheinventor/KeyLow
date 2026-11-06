import { buildFoodSnapshot } from "@keylow/core/diary";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { foodEntry } from "./support";
import { makeFood, makePortion } from "../foods/support";

import type { LogFoodInput, LogEntry, RecentFood } from "@keylow/api-client";
import type { RecipeIngredient } from "@keylow/core/recipes";
import type { Food, FoodPortion } from "@keylow/core/schemas";

import { AddFoodDialog } from "@/components/diary/AddFoodDialog";
import { AddIngredientDialog } from "@/components/recipes/AddIngredientDialog";
import { ToastProvider } from "@/components/ui/Toast";

const EGGS_ID = "11111111-1111-4111-8111-111111111111";
const OATS_ID = "11111111-1111-4111-8111-222222222222";
const eggs = makeFood({
  id: EGGS_ID,
  name: "Eggs, whole, boiled",
  source: "cofid",
  kcal: 150,
  protein_g: 12.5,
  carbs_g: 0,
  fat_g: 10.8,
});
const largeEgg = makePortion({
  id: "22222222-2222-4222-8222-111111111111",
  food_id: EGGS_ID,
  label: "1 large egg",
  grams: 60,
  is_default: true,
});
const oats = makeFood({
  id: OATS_ID,
  name: "Porridge oats",
  source: "cofid",
  kcal: 375,
  protein_g: 11,
  carbs_g: 60,
  fat_g: 8,
});

type RecentRead = {
  data: RecentFood[] | undefined;
  isError: boolean;
  fetchStatus: "idle" | "fetching" | "paused";
};

type Api = {
  recent: RecentRead;
  recentReads: number;
  foods: Map<string, Food>;
  portions: Map<string, FoodPortion[]>;
  logFood: { mutateAsync: ReturnType<typeof vi.fn<(input: LogFoodInput) => Promise<LogEntry>>> };
  deleteEntry: { mutateAsync: ReturnType<typeof vi.fn<(entry: LogEntry) => Promise<void>>> };
};

const api = vi.hoisted((): Api => ({
  recent: { data: undefined, isError: false, fetchStatus: "fetching" },
  recentReads: 0,
  foods: new Map(),
  portions: new Map(),
  logFood: { mutateAsync: undefined as never },
  deleteEntry: { mutateAsync: undefined as never },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useRefreshOutdatedOffFood: () => undefined,
  useProfileTimeZone: () => ({ data: "UTC" }),
  useRecentFoods: () => {
    api.recentReads += 1;
    return api.recent;
  },
  useFoodSearch: () => ({
    local: [],
    off: [],
    isLoadingLocal: false,
    isLoadingOff: false,
    isDebouncing: false,
    offError: null,
    localError: null,
  }),
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

// 12:40 on Thursday 15 October 2026 in UTC.
const NOW = new Date("2026-10-15T12:40:30Z");

function recentOf(
  food: Food,
  logged: { quantity: number; portion: FoodPortion } | { quantity: number; unit: "g" },
  loggedAt = "2026-10-14T18:00:00Z",
): RecentFood {
  const snapshot =
    "portion" in logged
      ? buildFoodSnapshot(food, {
          quantity: logged.quantity,
          unit: "portion",
          portion: logged.portion,
        })
      : buildFoodSnapshot(food, { quantity: logged.quantity, unit: "g" });

  return {
    foodId: food.id,
    entryId: "33333333-3333-4333-8333-333333333333",
    loggedAt,
    portionId: "portion" in logged ? logged.portion.id : null,
    snapshot,
  };
}

function renderDialog() {
  render(
    <ToastProvider>
      <AddFoodDialog
        request={{ date: "2026-10-15" }}
        opener={null}
        onClose={vi.fn()}
        onQuickAdd={vi.fn()}
      />
    </ToastProvider>,
  );
}

const plusOf = (name: string) => screen.getByRole("button", { name });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  api.recent = {
    data: [
      recentOf(eggs, { quantity: 2, portion: largeEgg }),
      recentOf(oats, { quantity: 40, unit: "g" }, "2026-10-13T08:00:00Z"),
    ],
    isError: false,
    fetchStatus: "idle",
  };
  api.recentReads = 0;
  api.foods = new Map([
    [EGGS_ID, eggs],
    [OATS_ID, oats],
  ]);
  api.portions = new Map([[EGGS_ID, [largeEgg]]]);
  api.logFood.mutateAsync = vi.fn((input: LogFoodInput) =>
    Promise.resolve(
      foodEntry({
        date: input.localDate,
        time: "12:00",
        name: input.food.name,
        quantity: input.quantity,
        unit: input.unit === "portion" ? "portion" : input.unit === "ml" ? "ml" : "g",
        kcal: 1,
        protein: 1,
        fat: 1,
        carbs: 1,
      }),
    ),
  );
  api.deleteEntry.mutateAsync = vi.fn(() => Promise.resolve());
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe("Recent in the add food dialog", () => {
  describe("the list", () => {
    it("should list the foods newest first with the amount last logged and its calories", () => {
      renderDialog();

      const list = within(screen.getByRole("region", { name: /Recent/ }));
      const rows = list.getAllByRole("listitem");

      expect(rows).toHaveLength(2);
      expect(rows[0]?.textContent).toContain("Eggs, whole, boiled");
      expect(rows[0]?.textContent).toContain("2 × 1 large egg (120 g)");
      expect(rows[0]?.textContent).toContain("180");
      expect(rows[1]?.textContent).toContain("Porridge oats");
      expect(rows[1]?.textContent).toContain("40 g");
    });

    it("should sit under Quick add", () => {
      renderDialog();

      const quickAdd = screen.getByRole("button", { name: /Quick add/ });
      const recent = screen.getByRole("region", { name: /Recent/ });

      expect(
        quickAdd.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("should go once something to search for is typed", () => {
      renderDialog();

      fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
        target: { value: "egg" },
      });

      expect(screen.queryByRole("region", { name: /Recent/ })).toBeNull();
    });

    it("should say there is nothing recent when no food has been logged", () => {
      api.recent = { data: [], isError: false, fetchStatus: "idle" };
      renderDialog();

      expect(screen.getByText("Nothing recent")).toBeTruthy();
    });

    it("should show a skeleton while the list loads", () => {
      api.recent = { data: undefined, isError: false, fetchStatus: "fetching" };
      renderDialog();

      expect(screen.getByRole("status", { name: "Loading recent foods" })).toBeTruthy();
    });

    it("should say quietly that the list could not be loaded, so the dialog is never blank", () => {
      api.recent = { data: undefined, isError: true, fetchStatus: "idle" };
      renderDialog();

      expect(screen.getByText("Couldn't load recent foods")).toBeTruthy();
      expect(screen.getByRole("button", { name: /Quick add/ })).toBeTruthy();
    });

    it("should say the same, not wait for ever, when offline with nothing cached", () => {
      api.recent = { data: undefined, isError: false, fetchStatus: "paused" };
      renderDialog();

      expect(screen.getByText("Couldn't load recent foods")).toBeTruthy();
      expect(screen.queryByRole("status", { name: "Loading recent foods" })).toBeNull();
    });

    it("should keep the rows it has when a refresh fails", () => {
      api.recent = { ...api.recent, isError: true };
      renderDialog();

      expect(screen.getByRole("region", { name: /Recent/ })).toBeTruthy();
      expect(screen.queryByText("Couldn't load recent foods")).toBeNull();
    });
  });

  describe("the plus", () => {
    it("should log the amount last logged at once, and say so with an Undo", async () => {
      renderDialog();

      fireEvent.click(plusOf("Add Eggs, whole, boiled, 2 × 1 large egg (120 g)"));

      await waitFor(() => {
        expect(api.logFood.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.logFood.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          food: eggs,
          quantity: 2,
          unit: "portion",
          portion: largeEgg,
          localDate: "2026-10-15",
        }),
      );
      expect(await screen.findByText("Added Eggs, whole, boiled")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      expect(screen.getByRole("dialog", { name: "Add food" })).toBeTruthy();
    });

    it("should log grams as grams", async () => {
      renderDialog();

      fireEvent.click(plusOf("Add Porridge oats, 40 g"));

      await waitFor(() => {
        expect(api.logFood.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ food: oats, quantity: 40, unit: "g" }),
        );
      });
    });

    it("should keep the grams a replaced portion came to", async () => {
      api.portions = new Map([[EGGS_ID, []]]);
      renderDialog();

      fireEvent.click(plusOf("Add Eggs, whole, boiled, 2 × 1 large egg (120 g)"));

      await waitFor(() => {
        expect(api.logFood.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ food: eggs, quantity: 120, unit: "g" }),
        );
      });
    });

    it("should be off when offline, and log nothing", () => {
      onlineManager.setOnline(false);
      renderDialog();

      const plus = plusOf("Add Eggs, whole, boiled, 2 × 1 large egg (120 g)");
      fireEvent.click(plus);

      expect(plus.getAttribute("aria-disabled")).toBe("true");
      expect(api.logFood.mutateAsync).not.toHaveBeenCalled();
    });

    it("should log once for a double press", async () => {
      renderDialog();
      const plus = plusOf("Add Porridge oats, 40 g");

      fireEvent.click(plus);
      fireEvent.click(plus);

      await waitFor(() => {
        expect(api.logFood.mutateAsync).toHaveBeenCalledOnce();
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(api.logFood.mutateAsync).toHaveBeenCalledOnce();
    });
  });

  describe("a press on the row", () => {
    it("should open the amount at the amount last logged, with the line saying when", () => {
      renderDialog();

      fireEvent.click(screen.getByRole("button", { name: /^Eggs, whole, boiled/ }));

      expect(screen.getByText("Last logged 2 × 1 large egg (120 g), yesterday")).toBeTruthy();
      expect(screen.getByRole<HTMLInputElement>("textbox", { name: /^Amount/ }).value).toBe("2");
      expect(screen.getByRole("radio", { name: "1 large egg", checked: true })).toBeTruthy();
    });

    it("should open grams at the grams last logged and say the day when it was not lately", () => {
      renderDialog();

      fireEvent.click(screen.getByRole("button", { name: /^Porridge oats/ }));

      expect(screen.getByRole<HTMLInputElement>("textbox", { name: /^Amount/ }).value).toBe("40");
      expect(screen.getByText("Last logged 40 g, Tue 13 Oct")).toBeTruthy();
    });

    it("should keep the grams a replaced portion came to", () => {
      api.portions = new Map([[EGGS_ID, []]]);
      renderDialog();

      fireEvent.click(screen.getByRole("button", { name: /^Eggs, whole, boiled/ }));

      expect(screen.getByRole<HTMLInputElement>("textbox", { name: /^Amount/ }).value).toBe("120");
    });

    it("should log the amount it opened on when Add is pressed", async () => {
      renderDialog();
      fireEvent.click(screen.getByRole("button", { name: /^Eggs, whole, boiled/ }));

      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        expect(api.logFood.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ quantity: 2, unit: "portion", portion: largeEgg }),
        );
      });
    });

    it("should go back to the list with the Results link", () => {
      renderDialog();
      fireEvent.click(screen.getByRole("button", { name: /^Eggs, whole, boiled/ }));

      fireEvent.click(screen.getByRole("button", { name: "Results" }));

      expect(screen.getByRole("region", { name: /Recent/ })).toBeTruthy();
      expect(screen.queryByText(/Last logged/)).toBeNull();
    });
  });

  describe("a food that needs review", () => {
    // The live food has lost its fat value since it was logged.
    beforeEach(() => {
      api.foods.set(EGGS_ID, { ...eggs, fat_g: null });
    });

    it("should not be logged by the plus, and should open its portion step instead", async () => {
      renderDialog();

      fireEvent.click(plusOf("Add Eggs, whole, boiled, 2 × 1 large egg (120 g)"));

      expect(await screen.findByRole("button", { name: "Results" })).toBeTruthy();
      expect(api.logFood.mutateAsync).not.toHaveBeenCalled();
      expect(screen.queryByText("Added Eggs, whole, boiled")).toBeNull();
      expect(screen.getByText("Last logged 2 × 1 large egg (120 g), yesterday")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Add" }).hasAttribute("disabled")).toBe(true);
    });
  });

  describe("a deleted food", () => {
    beforeEach(() => {
      api.foods.set(EGGS_ID, { ...eggs, deleted_at: "2026-10-15T09:00:00+00:00" });
    });

    it("should not be logged by the plus, and should not blame the connection", async () => {
      renderDialog();

      fireEvent.click(plusOf("Add Eggs, whole, boiled, 2 × 1 large egg (120 g)"));

      expect(
        await screen.findByText("This food does not exist, or you cannot see it."),
      ).toBeTruthy();
      expect(api.logFood.mutateAsync).not.toHaveBeenCalled();
      expect(screen.queryByText(/Check your connection/)).toBeNull();
      expect(screen.queryByText("Added Eggs, whole, boiled")).toBeNull();
    });
  });

  describe("the amount after going back", () => {
    it("should open at the amount last logged again, not at what was typed", () => {
      renderDialog();
      fireEvent.click(screen.getByRole("button", { name: /^Eggs, whole, boiled/ }));
      fireEvent.change(screen.getByRole("textbox", { name: /^Amount/ }), {
        target: { value: "5" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Results" }));

      fireEvent.click(screen.getByRole("button", { name: /^Eggs, whole, boiled/ }));

      expect(screen.getByRole<HTMLInputElement>("textbox", { name: /^Amount/ }).value).toBe("2");
    });
  });

  describe("the hint to type something", () => {
    const hint = "Type at least 2 characters to search";

    it("should not be shown while Recent has rows", () => {
      renderDialog();

      expect(screen.queryByText(hint)).toBeNull();
    });

    it("should be shown when there is no history", () => {
      api.recent = { data: [], isError: false, fetchStatus: "idle" };
      renderDialog();

      expect(screen.getByText(hint)).toBeTruthy();
    });

    it("should be shown when the list could not be loaded", () => {
      api.recent = { data: undefined, isError: true, fetchStatus: "idle" };
      renderDialog();

      expect(screen.getByText(hint)).toBeTruthy();
    });
  });

  describe("an ingredient search", () => {
    function renderIngredientDialog() {
      const onAdd = vi.fn<(ingredient: RecipeIngredient) => void>();
      render(<AddIngredientDialog opener={null} onClose={vi.fn()} onAdd={onAdd} />);

      return { onAdd };
    }

    it("should list Recent alone, with no plus and no Quick add", () => {
      renderIngredientDialog();

      expect(screen.getByRole("region", { name: /Recent/ })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Add Eggs/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /Quick add/ })).toBeNull();
    });

    it("should open the amount at the amount last logged, and add that to the recipe", () => {
      const { onAdd } = renderIngredientDialog();

      fireEvent.click(screen.getByRole("button", { name: /^Eggs, whole, boiled/ }));

      expect(screen.getByRole<HTMLInputElement>("textbox", { name: /^Amount/ }).value).toBe("2");
      expect(screen.getByRole("radio", { name: "1 large egg", checked: true })).toBeTruthy();
      expect(screen.queryByText(/Last logged/)).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Add to recipe" }));

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ food_id: EGGS_ID, quantity: 2, unit: "portion" }),
      );
    });
  });
});
