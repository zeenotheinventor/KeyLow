import { buildLogEntry } from "@keylow/core/diary";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MILK_DENSITY,
  OLIVE_OIL_DENSITY,
  banana,
  chickenBreast,
  chickenThigh,
  ketchup,
  milk,
  oliveOil,
  syrup,
  yoghurt,
} from "./portionFoods";
import { makeSearchHit } from "../foods/support";

import type { FoodWithPortions } from "./portionFoods";
import type { FoodSearchHit, LogFoodInput } from "@keylow/api-client";
import type { Food, FoodPortion } from "@keylow/core/schemas";

import { AddFoodDialog } from "@/components/diary/AddFoodDialog";
import { ToastProvider } from "@/components/ui/Toast";

type Api = {
  foods: Map<string, Food>;
  portions: Map<string, FoodPortion[]>;
  hits: FoodSearchHit[];
  logged: LogFoodInput[];
};

const api = vi.hoisted((): Api => ({
  foods: new Map(),
  portions: new Map(),
  hits: [],
  logged: [],
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "UTC" }),
  useFoodSearch: () => ({
    local: api.hits,
    off: [],
    isLoadingLocal: false,
    isLoadingOff: false,
    isDebouncing: false,
    offError: null,
    localError: null,
  }),
  // The recipes are the recipes tests' business: here the search finds nothing and nothing is logged.
  useRecipeSearch: () => ({ recipes: [], isLoading: false, isDebouncing: false, error: null }),
  useLogRecipeServing: () => ({ mutateAsync: () => Promise.reject(new Error("not used")) }),
  useFoodWithPortions: (id: string) => {
    const food = api.foods.get(id);
    return food === undefined
      ? { status: "notFound" }
      : { status: "ready", food, portions: api.portions.get(id) ?? [] };
  },
  useLogFood: () => ({
    mutateAsync: (input: LogFoodInput) => {
      api.logged.push(input);
      return Promise.resolve();
    },
  }),
  useDeleteEntry: () => ({ mutateAsync: () => Promise.resolve() }),
  useSupabase: () => ({}),
}));

const NOW = new Date("2026-10-15T12:40:30Z");

function hitOf(food: Food): FoodSearchHit {
  return makeSearchHit({
    id: food.id,
    name: food.name,
    source: food.source,
    kcal: food.kcal,
    protein_g: food.protein_g,
    fat_g: food.fat_g,
    carbs_g: food.carbs_g,
  });
}

// The words of a name, with the comma and the space between them left loose: the row marks the match in pieces.
const rowNamed = (name: string) => new RegExp(`^${name.replace(/[\s,]+/g, "[\\s,]*")}`);

/** Opens the portion step of the food, the way a person does: search, then press its row. */
function openFood({ food, portions }: FoodWithPortions) {
  api.foods = new Map([[food.id, food]]);
  api.portions = new Map([[food.id, portions]]);
  api.hits = [hitOf(food)];
  render(
    <ToastProvider>
      <AddFoodDialog
        request={{ date: "2026-10-15" }}
        opener={null}
        onClose={vi.fn<() => void>()}
        onQuickAdd={vi.fn<() => void>()}
      />
    </ToastProvider>,
  );
  fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
    target: { value: "food" },
  });
  fireEvent.click(
    within(screen.getByRole("group", { name: "Search results" })).getByRole("button", {
      name: rowNamed(food.name),
    }),
  );
}

const chipNames = () => screen.getAllByRole("radio").map((chip) => chip.textContent);
const amountField = (unit: string) => screen.getByRole("textbox", { name: `Amount (${unit})` });
const typeAmount = (unit: string, text: string) => {
  fireEvent.change(amountField(unit), { target: { value: text } });
};

/** The one entry the dialog logged, built the way the database layer builds it. */
async function loggedEntry() {
  await waitFor(() => {
    expect(api.logged).toHaveLength(1);
  });
  const [input] = api.logged;
  if (input === undefined) {
    throw new Error("Nothing was logged");
  }

  return buildLogEntry(input);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  api.logged = [];
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe("the add dialog's chips", () => {
  describe("natural portions first", () => {
    it("should open a banana on its default portion with an amount of 1, and the other sizes then g", () => {
      openFood(banana);

      expect(chipNames()).toEqual(["1 small", "1 medium", "1 large", "g"]);
      expect(screen.getByRole("radio", { name: "1 medium", checked: true })).toBeTruthy();
      expect(amountField("medium")).toHaveProperty("value", "1");
    });

    it("should offer a banana no ml, 1 tsp or 1 tbsp chip, not even a disabled one", () => {
      openFood(banana);

      expect(screen.queryByRole("radio", { name: "ml" })).toBeNull();
      expect(screen.queryByRole("radio", { name: "1 tsp" })).toBeNull();
      expect(screen.queryByRole("radio", { name: "1 tbsp" })).toBeNull();
    });

    it("should open a chicken thigh on 1 thigh", () => {
      openFood(chickenThigh);

      expect(screen.getByRole("radio", { name: "1 thigh", checked: true })).toBeTruthy();
      expect(amountField("thigh")).toHaveProperty("value", "1");
      expect(chipNames()).toEqual(["1 thigh", "g"]);
    });

    it("should open a food with no natural portion on g", () => {
      openFood(chickenBreast);

      expect(chipNames()).toEqual(["g"]);
      expect(screen.getByRole("radio", { name: "g", checked: true })).toBeTruthy();
      expect(amountField("g")).toHaveProperty("value", "100");
    });
  });

  describe("a food that is measured by volume", () => {
    it("should offer g, ml, 1 tsp and 1 tbsp, in that order, and open on g", () => {
      openFood(oliveOil);

      expect(chipNames()).toEqual(["g", "ml", "1 tsp", "1 tbsp"]);
      expect(screen.getByRole("radio", { name: "g", checked: true })).toBeTruthy();
    });

    it("should put the natural portion first, then g, then ml, 1 tsp and 1 tbsp", () => {
      openFood(yoghurt);

      expect(chipNames()).toEqual(["1 pot", "g", "ml", "1 tsp", "1 tbsp"]);
      expect(screen.getByRole("radio", { name: "1 pot", checked: true })).toBeTruthy();
    });

    it("should keep a food's own gram portion apart from the spoon when both are called 1 tbsp", () => {
      openFood(syrup);

      const [own, spoon] = screen.getAllByRole("radio", { name: "1 tbsp" });
      expect(chipNames()).toEqual(["1 tbsp", "g", "ml", "1 tsp", "1 tbsp"]);
      expect(own).toHaveProperty("ariaChecked", "true");
      expect(spoon).toHaveProperty("ariaChecked", "false");
      expect(
        screen.getByRole("group", { name: "Energy and macros, For 1 tbsp (21 g)" }),
      ).toBeTruthy();

      if (spoon === undefined) {
        throw new Error("The spoon chip is missing");
      }
      fireEvent.click(spoon);

      expect(
        screen.getByRole("group", { name: "Energy and macros, For 1 tbsp (15 ml, 21 g)" }),
      ).toBeTruthy();
    });
  });

  describe("logging in spoons", () => {
    it("should say the spoon, its millilitres and its weight in the hero, and log what the hero says", async () => {
      openFood(oliveOil);

      fireEvent.click(screen.getByRole("radio", { name: "1 tbsp" }));
      typeAmount("tbsp", "2");

      const hero = screen.getByRole("group", {
        name: "Energy and macros, For 2 tbsp (30 ml, 28 g)",
      });
      expect(within(hero).getByText("248")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      const entry = await loggedEntry();
      expect(entry.unit).toBe("portion");
      expect(entry.quantity).toBe(2);
      expect(entry.portion_id).toBeNull();
      expect(entry.snapshot.portion).toEqual({ label: "1 tbsp", ml: 15 });
      expect(entry.snapshot.density).toBe(OLIVE_OIL_DENSITY);
      expect(entry.resolved_grams).toBeCloseTo(2 * 15 * OLIVE_OIL_DENSITY);
      expect(entry.nutrients.kcal).toBeCloseTo((899 * entry.resolved_grams) / 100);
    });

    it("should write a single teaspoon as 1 tsp and call the amount tsp", () => {
      openFood(oliveOil);

      fireEvent.click(screen.getByRole("radio", { name: "1 tsp" }));
      typeAmount("tsp", "1");

      expect(amountField("tsp")).toHaveProperty("value", "1");
      expect(
        screen.getByRole("group", { name: "Energy and macros, For 1 tsp (5 ml, 4.6 g)" }),
      ).toBeTruthy();
    });

    it("should say the millilitres and then the weight for a volume, and log it in ml", async () => {
      openFood(milk);

      fireEvent.click(screen.getByRole("radio", { name: "ml" }));
      typeAmount("ml", "250");

      expect(
        screen.getByRole("group", { name: "Energy and macros, For 250 ml (258 g)" }),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      const entry = await loggedEntry();
      expect(entry.unit).toBe("ml");
      expect(entry.quantity).toBe(250);
      expect(entry.portion_id).toBeNull();
      expect(entry.snapshot.portion).toBeNull();
      expect(entry.snapshot.density).toBe(MILK_DENSITY);
      expect(entry.resolved_grams).toBeCloseTo(250 * MILK_DENSITY);
    });

    it("should offer a branded food spoons from its own serving, and log them at the label's weight", async () => {
      openFood(ketchup);

      expect(chipNames()).toEqual(["1 tbsp (15 g)", "g", "ml", "1 tsp", "1 tbsp"]);
      fireEvent.click(screen.getByRole("radio", { name: "1 tbsp" }));
      typeAmount("tbsp", "2");

      expect(
        screen.getByRole("group", { name: "Energy and macros, For 2 tbsp (30 ml, 30 g)" }),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      const entry = await loggedEntry();
      expect(entry.snapshot.density).toBe(1);
      expect(entry.resolved_grams).toBeCloseTo(30, 10);
    });

    it("should never write about, or note an estimated density, anywhere in the dialog", () => {
      openFood(oliveOil);

      fireEvent.click(screen.getByRole("radio", { name: "1 tbsp" }));

      expect(
        screen.queryByText(/about|approximately|roughly|estimated (density|weight)/i),
      ).toBeNull();
    });

    it("should go to dashes and not allow Add for a spoon amount that is not above 0", () => {
      openFood(oliveOil);
      fireEvent.click(screen.getByRole("radio", { name: "1 tbsp" }));

      typeAmount("tbsp", "0");

      expect(
        screen.getByRole("group", { name: "Energy and macros, For this amount" }),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Add" })).toHaveProperty("disabled", true);
    });
  });
});

describe("pressing a different chip", () => {
  it("should set a food on g at 100 to 1 when 1 tbsp is pressed, not read 100 tbsp", () => {
    openFood(oliveOil);
    expect(amountField("g")).toHaveProperty("value", "100");

    fireEvent.click(screen.getByRole("radio", { name: "1 tbsp" }));

    expect(amountField("tbsp")).toHaveProperty("value", "1");
    expect(
      screen.getByRole("group", { name: "Energy and macros, For 1 tbsp (15 ml, 14 g)" }),
    ).toBeTruthy();
  });

  it("should set a spoon back to 100 when g is pressed", () => {
    openFood(oliveOil);
    fireEvent.click(screen.getByRole("radio", { name: "1 tbsp" }));
    typeAmount("tbsp", "2");

    fireEvent.click(screen.getByRole("radio", { name: "g" }));

    expect(amountField("g")).toHaveProperty("value", "100");
  });

  it("should set a banana on 1 medium to 100 when g is pressed, not read 1 g", () => {
    openFood(banana);

    fireEvent.click(screen.getByRole("radio", { name: "g" }));

    expect(amountField("g")).toHaveProperty("value", "100");
    expect(screen.getByRole("group", { name: "Energy and macros, For 100 g" })).toBeTruthy();
  });

  it("should replace a typed amount, so 250 g does not become 250 tbsp", () => {
    openFood(oliveOil);
    typeAmount("g", "250");

    fireEvent.click(screen.getByRole("radio", { name: "1 tbsp" }));

    expect(amountField("tbsp")).toHaveProperty("value", "1");
  });

  it("should keep the amount when the chip already chosen is pressed", () => {
    openFood(oliveOil);
    typeAmount("g", "250");

    fireEvent.click(screen.getByRole("radio", { name: "g" }));

    expect(amountField("g")).toHaveProperty("value", "250");
  });

  it("should log the amount the chip set, not the one typed before it", async () => {
    openFood(oliveOil);
    typeAmount("g", "250");

    fireEvent.click(screen.getByRole("radio", { name: "1 tsp" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const entry = await loggedEntry();
    expect(entry.unit).toBe("portion");
    expect(entry.quantity).toBe(1);
  });
});
