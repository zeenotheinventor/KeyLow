import { MEAL_PLAN_BAND_TIMES } from "./constants";
import { instantAtLocalTime } from "../dates/instantAtLocalTime";

import type { PlanItemRow } from "./planView";
import type { BuildLogEntryInput } from "../diary/buildLogEntry";
import type { BuildRecipeLogEntryInput } from "../diary/buildRecipeLogEntry";
import type { LoggableRecipe } from "../diary/recipeSnapshotQuantity";
import type { Food } from "../schemas/food";

/** One diary entry to write for a planned item: a food in grams, or a recipe by the serving. */
export type ConfirmEntryInput =
  { kind: "food"; input: BuildLogEntryInput } | { kind: "recipe"; input: BuildRecipeLogEntryInput };

const clockOf = (slotTime: string | null): { hour: number; minute: number } => {
  const [hour = 0, minute = 0] = (slotTime ?? MEAL_PLAN_BAND_TIMES.midday).split(":").map(Number);
  return { hour, minute };
};

/**
 * The diary entries confirming a day writes: each planned item as the food or recipe is now (so the entry's
 * snapshot is fresh), at the item's time on `localDate` in the person's time zone. An item with no time is
 * logged at midday. Throws a `RangeError` that names no value for an item whose food or recipe is gone, so
 * nothing is half written.
 */
export const confirmInputsOfDay = ({
  localDate,
  timeZone,
  items,
  foods,
  recipes,
}: {
  localDate: string;
  timeZone: string;
  items: readonly PlanItemRow[];
  foods: ReadonlyMap<string, Food>;
  recipes: ReadonlyMap<string, LoggableRecipe>;
}): ConfirmEntryInput[] =>
  [...items]
    .sort((first, second) => first.position - second.position || first.id.localeCompare(second.id))
    .map((item): ConfirmEntryInput => {
      const { hour, minute } = clockOf(item.slotTime);
      const loggedAt = instantAtLocalTime(localDate, hour, minute, timeZone).toISOString();
      if (item.kind === "recipe") {
        const recipe = item.recipeId === null ? undefined : recipes.get(item.recipeId);
        if (recipe === undefined) {
          throw new RangeError("A planned recipe is no longer available");
        }
        return {
          kind: "recipe",
          input: { recipe, quantity: item.servings, unit: "serving", loggedAt, localDate },
        };
      }
      const food = item.foodId === null ? undefined : foods.get(item.foodId);
      if (food === undefined) {
        throw new RangeError("A planned food is no longer available");
      }
      return {
        kind: "food",
        input: { food, quantity: item.grams, unit: "g", loggedAt, localDate },
      };
    });
