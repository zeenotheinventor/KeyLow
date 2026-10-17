import {
  getFood,
  listFoodPortions,
  useDeleteEntry,
  useLogFood,
  useLogRecipeServing,
  useProfileTimeZone,
  useSupabase,
} from "@keylow/api-client";
import { LOG_SEARCH, SAVE_FAILED_BANNER, describeAddedFood } from "@keylow/core/copy";
import { openingLoggedAt, recipeAmountStart } from "@keylow/core/diary";
import { servingOfHit } from "@keylow/core/search";
import { useRef } from "react";

import { amountLastLogged } from "../../lib/amountLastLogged";
import { useIsOnline } from "../../lib/connectivity";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { useToast } from "../ui";

import type { LoggableAmount } from "../../lib/amountLastLogged";
import type { FoodSearchHit, LogEntry, RecentFood, RecipeSummary } from "@keylow/api-client";
import type { LogContext } from "@keylow/core/diary";
import type { Food, FoodPortion } from "@keylow/core/schemas";

export type AddServing = {
  /** False offline, and until the profile's time zone is known, because the time is read in it. */
  canAdd: boolean;
  /** Logs the serving a result row shows. */
  addHit: (hit: FoodSearchHit) => void;
  /** Logs the amount a Recent food was last logged with. */
  addRecent: (recent: RecentFood) => void;
  /** Logs one serving of a recipe a result row shows. */
  addRecipe: (recipe: RecipeSummary) => void;
};

/**
 * The one-tap plus of the log search. A tap loads the whole food and its portions by id (a result row is
 * lean), logs the serving at the sheet's time (`openingLoggedAt` with the sheet's day and hour, read in the
 * profile's zone) and says so in a toast with an Undo, which removes only the entry that tap made. The sheet
 * stays open. A tap on a food whose last tap has not finished is ignored, so a double tap logs once. A
 * failure says that the food was not saved, and never what the amount was. A recipe's plus is the same
 * without the load: the result row already holds what the recipe is logged from, and the amount is one
 * serving.
 */
export function useAddServing(context: LogContext): AddServing {
  const client = useSupabase();
  const toast = useToast();
  const logFood = useLogFood();
  const logRecipe = useLogRecipeServing();
  const deleteEntry = useDeleteEntry();
  const isOnline = useIsOnline();
  const timeZone = useProfileTimeZone({ enabled: useReadsEnabled() }).data;
  const inFlight = useRef(new Set<string>());

  // Runs one tap's logging, unless the last tap on the same row has not finished. `log` resolves to the
  // name and the stored entry for the toast, or to null when there is nothing to log.
  async function addOnce(
    key: string,
    log: (zone: string) => Promise<{ name: string; entry: LogEntry } | null>,
  ) {
    if (timeZone === undefined || inFlight.current.has(key)) {
      return;
    }
    inFlight.current.add(key);
    const notSaved = () => {
      toast.show({ message: SAVE_FAILED_BANNER, tone: "danger", icon: "CircleAlert" });
    };
    try {
      const added = await log(timeZone ?? "UTC");
      if (added === null) {
        notSaved();
        return;
      }
      const { name, entry } = added;
      toast.show({
        message: describeAddedFood(name),
        tone: "success",
        icon: "Check",
        actionLabel: LOG_SEARCH.undo,
        onAction: () => {
          deleteEntry.mutateAsync(entry).catch(() => {
            toast.show({ message: LOG_SEARCH.undoFailed, tone: "danger", icon: "CircleAlert" });
          });
        },
      });
    } catch {
      // Not kept: the failure can quote the amount, which is health data.
      notSaved();
    } finally {
      inFlight.current.delete(key);
    }
  }

  function add(
    foodId: string,
    chooseAmount: (food: Food, portions: readonly FoodPortion[]) => LoggableAmount,
  ) {
    return addOnce(foodId, async (zone) => {
      const [food, portions] = await Promise.all([
        getFood(client, foodId),
        listFoodPortions(client, foodId),
      ]);
      if (food === null) {
        return null;
      }
      const amount = chooseAmount(food, portions);
      const { loggedAt, localDate } = openingLoggedAt(new Date(), context, zone);
      const entry = await logFood.mutateAsync({
        food,
        quantity: amount.quantity,
        unit: amount.unit,
        ...(amount.unit === "portion" ? { portion: amount.portion } : {}),
        loggedAt: loggedAt.toISOString(),
        localDate,
      });
      return { name: food.name, entry };
    });
  }

  return {
    canAdd: isOnline && timeZone !== undefined,
    addHit: (hit) => {
      void add(hit.id, (food, portions) => servingOfHit(hit, food, portions));
    },
    addRecent: (recent) => {
      void add(recent.foodId, (_food, portions) => amountLastLogged(recent, portions));
    },
    addRecipe: (recipe) => {
      void addOnce(recipe.id, async (zone) => {
        const { loggedAt, localDate } = openingLoggedAt(new Date(), context, zone);
        const entry = await logRecipe.mutateAsync({
          recipe,
          ...recipeAmountStart(),
          loggedAt: loggedAt.toISOString(),
          localDate,
        });
        return { name: recipe.name, entry };
      });
    },
  };
}
