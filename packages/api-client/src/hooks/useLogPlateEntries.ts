import { foodNeedsReview } from "@keylow/core/diary";
import { plateFoodAmount } from "@keylow/core/plate";
import { useMutation } from "@tanstack/react-query";

import { useLogEntries } from "./useLogEntries";
import { useSupabase } from "../KeyLowProvider";
import { getFood, listFoodPortions } from "../repos/foods";

import type { LogEntriesItem } from "../repos/diaryWrites";
import type { PlateItem } from "@keylow/core/plate";
import type { Food, FoodPortion } from "@keylow/core/schemas";

/** When the whole plate is logged, as `LogFoodInput` and `LogRecipeInput` take it. */
export type PlateLoggedWhen = { loggedAt: string; localDate: string };

/** What the plate is logged from: its rows, and the one moment and day they all share. */
export type LogPlateEntriesInput = PlateLoggedWhen & { items: readonly PlateItem[] };

/** How a plate row's food is read. The hook passes the client's reads, and a test can pass its own. */
export type PlateFoodReaders = {
  getFood: (foodId: string) => Promise<Food | null>;
  listFoodPortions: (foodId: string) => Promise<FoodPortion[]>;
};

/** A food on the plate is gone: deleted, or no longer visible. The message names no food. */
export class PlateFoodGoneError extends Error {
  constructor() {
    super("A food on the plate is no longer there");
    this.name = "PlateFoodGoneError";
  }
}

/** A food on the plate now needs review (flagged suspect, or missing energy or a macro), so it cannot be logged. */
export class PlateFoodNeedsReviewError extends Error {
  constructor() {
    super("A food on the plate needs review");
    this.name = "PlateFoodNeedsReviewError";
  }
}

type LoadedFood = { food: Food; portions: FoodPortion[] };

// Every distinct food on the plate, read once with its portions. A food that cannot be read, is gone or deleted, or
// needs review, fails the whole log: the plate is never partly logged.
async function loadFoods(
  readers: PlateFoodReaders,
  items: readonly PlateItem[],
): Promise<Map<string, LoadedFood>> {
  const foodIds = new Set(items.flatMap((item) => (item.kind === "food" ? [item.foodId] : [])));
  const loaded = await Promise.all(
    [...foodIds].map(async (foodId) => {
      const [food, portions] = await Promise.all([
        readers.getFood(foodId),
        readers.listFoodPortions(foodId),
      ]);
      // `getFood` also returns a deleted food, and a plate can hold one that was deleted after it was added.
      if (food === null || food.deleted_at !== null) {
        throw new PlateFoodGoneError();
      }
      // The search offers no plus for a food that needs review, but it can have changed since the row was added.
      if (foodNeedsReview(food)) {
        throw new PlateFoodNeedsReviewError();
      }

      return [foodId, { food, portions }] as const;
    }),
  );

  return new Map(loaded);
}

// What one row is logged as, at the time the whole plate shares. Undefined when the row cannot be logged.
function entryOfRow(
  item: PlateItem,
  foods: ReadonlyMap<string, LoadedFood>,
  when: PlateLoggedWhen,
): LogEntriesItem | undefined {
  if (item.kind === "recipe") {
    return {
      kind: "recipe",
      input: { recipe: item.recipe, quantity: item.quantity, unit: item.unit, ...when },
    };
  }
  const loaded = foods.get(item.foodId);
  const amount = loaded === undefined ? undefined : plateFoodAmount(item, loaded.portions);
  if (loaded === undefined || amount === undefined) {
    return undefined;
  }

  return {
    kind: "food",
    input: {
      food: loaded.food,
      quantity: amount.quantity,
      unit: amount.unit,
      ...(amount.unit === "portion" ? { portion: amount.portion } : {}),
      foodPortions: loaded.portions,
      ...when,
    },
  };
}

/**
 * The rows to write for a plate, in plate order, with each food read as it is now: a portion row is
 * resolved against the food's portions, and keeps the weight eaten when the portion has gone. Throws when a
 * food cannot be read, is gone or deleted, or needs review, or when a row has no valid amount. The error names no
 * food and no amount, since both are health data.
 */
export async function plateEntriesOf(
  readers: PlateFoodReaders,
  { items, ...when }: LogPlateEntriesInput,
): Promise<LogEntriesItem[]> {
  const foods = await loadFoods(readers, items);
  const entries = items.map((item) => entryOfRow(item, foods, when));
  const loggable = entries.filter((entry) => entry !== undefined);
  if (loggable.length !== items.length) {
    throw new Error("A row on the plate cannot be logged");
  }

  return loggable;
}

/**
 * Logs a plate: reads each distinct food on it once, with its portions, then writes every row through
 * `useLogEntries`, in one all-or-nothing request at the one moment and day given. A food that cannot be read
 * fails the whole log before anything is sent, so a plate is never partly logged. It does no navigation and
 * shows no toast. Needs a connection, as `useLogEntries` does. `mutateAsync` resolves to the stored rows in
 * the order of the plate, and rejects with an error that names no food and no amount.
 */
export function useLogPlateEntries() {
  const client = useSupabase();
  const { mutateAsync: logEntries } = useLogEntries();

  return useMutation({
    // An offline log fails at once instead of pausing, as `useLogEntries` does.
    networkMode: "always",
    mutationFn: async (input: LogPlateEntriesInput) =>
      logEntries(
        await plateEntriesOf(
          {
            getFood: (foodId) => getFood(client, foodId),
            listFoodPortions: (foodId) => listFoodPortions(client, foodId),
          },
          input,
        ),
      ),
  });
}
