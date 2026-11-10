import { buildFoodSnapshot, buildLogEntry } from "@keylow/core/diary";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noPlateHooks } from "./noPlateHooks";
import { noFavouriteHooks } from "../favourites/noFavouriteHooks";
import { makeFood, makePortion, makeSearchHit } from "../foods/support";

import type {
  FoodSearchHit,
  LogFoodInput,
  LogPlateEntriesInput,
  RecentFood,
} from "@keylow/api-client";
import type { Food, FoodPortion } from "@keylow/core/schemas";

import { AddFoodDialog, PortionStep } from "@/components/diary/AddFoodDialog";
import { AddIngredientDialog } from "@/components/recipes/AddIngredientDialog";
import { ToastProvider } from "@/components/ui/Toast";

type Api = {
  foods: Map<string, Food>;
  portions: Map<string, FoodPortion[]>;
  hits: FoodSearchHit[];
  recent: RecentFood[];
  logged: LogFoodInput[];
};

const api = vi.hoisted((): Api => ({
  foods: new Map(),
  portions: new Map(),
  hits: [],
  recent: [],
  logged: [],
}));

vi.mock("@keylow/api-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@keylow/api-client")>();

  return {
    ...original,
    ...noFavouriteHooks,
    ...noPlateHooks,
    // The refresh of an old branded food is the off refresh tests' business.
    useRefreshOutdatedOffFood: () => undefined,
    useRecentFoods: () => ({ data: api.recent, isError: false, fetchStatus: "idle" }),
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
    // The plate is written by the api-client. Here its rows are turned into the food inputs it would write.
    useLogPlateEntries: () => ({
      mutateAsync: async (input: LogPlateEntriesInput) => {
        const entries = await original.plateEntriesOf(
          {
            getFood: (id) => Promise.resolve(api.foods.get(id) ?? null),
            listFoodPortions: (id) => Promise.resolve(api.portions.get(id) ?? []),
          },
          input,
        );
        for (const entry of entries) {
          if (entry.kind === "food") {
            api.logged.push(entry.input);
          }
        }

        return [];
      },
    }),
    useSupabase: () => ({}),
  };
});

const bucket = makeFood({
  id: "55555555-5555-4555-8555-555555555555",
  owner_id: null,
  source: "restaurant",
  name: "Bargain bucket",
  basis: "per_portion",
  kcal: 500,
  protein_g: 40,
  fat_g: 30,
  carbs_g: 20,
});
const bucketPortion = makePortion({
  id: "66666666-6666-4666-8666-666666666666",
  food_id: bucket.id,
  owner_id: null,
  label: "1 bucket",
  grams: null,
  ml: null,
  is_default: true,
});
const cheese = makeFood({
  id: "77777777-7777-4777-8777-777777777777",
  name: "Cheese bucket of curds",
  source: "cofid",
});

function hitOf(food: Food): FoodSearchHit {
  return makeSearchHit({
    id: food.id,
    name: food.name,
    source: food.source,
    kcal: food.kcal,
    protein_g: food.protein_g,
    fat_g: food.fat_g,
    carbs_g: food.carbs_g,
    basis: food.basis,
    default_portion_id: bucketPortion.id,
    default_portion_label: bucketPortion.label,
  });
}

function openBucket(dialog: "diary" | "ingredient" = "diary") {
  api.foods = new Map([[bucket.id, bucket]]);
  api.portions = new Map([[bucket.id, [bucketPortion]]]);
  api.hits = [hitOf(bucket)];
  render(
    <ToastProvider>
      {dialog === "diary" ? (
        <AddFoodDialog
          request={{ date: "2026-10-15" }}
          opener={null}
          onClose={vi.fn<() => void>()}
        />
      ) : (
        <AddIngredientDialog opener={null} onClose={vi.fn<() => void>()} onAdd={vi.fn()} />
      )}
    </ToastProvider>,
  );
}

// The words of a name, with the space between them left loose: the row marks the match in pieces.
const rowNamed = (name: string) => new RegExp(`^${name.replace(/\s+/g, "[\\s,]*")}`);

const search = (text: string) => {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
    target: { value: text },
  });
};
const results = () => within(screen.getByRole("group", { name: "Search results" }));
const amountField = (unit: string) => screen.getByRole("textbox", { name: `Amount (${unit})` });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T12:40:30Z"));
  api.logged = [];
  api.recent = [];
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe("a food with no published weight in the add dialog", () => {
  it("should show its row by the portion, with no 100 g and no gram figure", () => {
    openBucket();

    search("bucket");

    const row = results().getByRole("button", { name: rowNamed("Bargain bucket") });
    expect(row.textContent).not.toMatch(/100 g|\bg\)/);
    expect(row.textContent).toContain("1 bucket");
  });

  it("should open on 1 bucket with only that chip and a hero for one bucket", () => {
    openBucket();
    search("bucket");
    fireEvent.click(results().getByRole("button", { name: rowNamed("Bargain bucket") }));

    expect(screen.getAllByRole("radio").map((chip) => chip.textContent)).toEqual(["1 bucket"]);
    expect(screen.getByRole("radio", { name: "1 bucket", checked: true })).toBeTruthy();
    expect(amountField("bucket")).toHaveProperty("value", "1");
    const hero = within(screen.getByRole("group", { name: "Energy and macros, For 1 bucket" }));
    expect(hero.getByText("500")).toBeTruthy();
    expect(screen.queryByText(/100 g/)).toBeNull();
  });

  it("should work out 750 kcal for 1.5 portions and log them with no grams", async () => {
    openBucket();
    search("bucket");
    fireEvent.click(results().getByRole("button", { name: rowNamed("Bargain bucket") }));

    fireEvent.change(amountField("bucket"), { target: { value: "1.5" } });
    const hero = within(
      screen.getByRole("group", { name: "Energy and macros, For 1.5 × 1 bucket" }),
    );
    expect(hero.getByText("750")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add to plate" }));
    fireEvent.click(screen.getByRole("button", { name: "Log food, 1 food on your plate" }));

    await waitFor(() => {
      expect(api.logged).toHaveLength(1);
    });
    const [input] = api.logged;
    if (input === undefined) {
      throw new Error("Nothing was logged");
    }
    const entry = buildLogEntry(input);
    expect(entry).toMatchObject({ quantity: 1.5, unit: "portion", resolved_grams: 0 });
    expect(entry.nutrients.kcal).toBe(750);
  });

  it("should offer no Copy to your foods when it is missing a value", () => {
    render(
      <PortionStep
        draft={{
          status: "ready",
          food: bucket,
          portions: [bucketPortion],
          unitOptions: [{ value: bucketPortion.id, label: "1 bucket" }],
          preview: { amount: null, hero: { caption: "For 1 bucket", values: null } },
          quantityText: "1",
          unitValue: bucketPortion.id,
          needsReview: true,
          setQuantityText: vi.fn(),
          setUnitValue: vi.fn(),
        }}
        time="12:00"
        isNow={false}
        onTimeChange={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("Needs review")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Copy to your foods" })).toBeNull();
  });
});

describe("a food with no published weight in the Add ingredient dialog", () => {
  it("should leave it out of the search results", () => {
    openBucket("ingredient");
    api.hits = [hitOf(bucket), hitOf(cheese)];

    search("bucket");

    expect(
      results().getByRole("button", { name: rowNamed("Cheese bucket of curds") }),
    ).toBeTruthy();
    expect(results().queryByRole("button", { name: rowNamed("Bargain bucket") })).toBeNull();
  });

  it("should leave it out of Recent", () => {
    api.recent = [
      {
        foodId: bucket.id,
        entryId: "entry-1",
        loggedAt: "2026-10-14T07:05:00Z",
        portionId: bucketPortion.id,
        snapshot: buildFoodSnapshot(bucket, {
          quantity: 1,
          unit: "portion",
          portion: { label: "1 bucket", grams: null, ml: null },
        }),
      },
    ];
    openBucket("ingredient");

    expect(screen.queryByText("Bargain bucket")).toBeNull();
  });
});
