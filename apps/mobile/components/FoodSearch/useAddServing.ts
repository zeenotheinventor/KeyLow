import {
  getFood,
  listFoodPortions,
  useDeleteEntry,
  useLogFood,
  useProfileTimeZone,
  useSupabase,
} from "@keylow/api-client";
import { SAVE_FAILED_BANNER, LOG_SEARCH, describeAddedFood } from "@keylow/core/copy";
import { useRef } from "react";

import { amountLastLogged } from "../../lib/amountLastLogged";
import { useIsOnline } from "../../lib/connectivity";
import { openingLoggedAt } from "../../lib/loggedAt";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { useToast } from "../ui";

import type { LoggableAmount } from "../../lib/amountLastLogged";
import type { LogContext } from "../../lib/navigation";
import type { FoodSearchHit, RecentFood } from "@keylow/api-client";
import type { Food, FoodPortion } from "@keylow/core/schemas";

export type AddServing = {
  /** False offline, and until the profile's time zone is known, because the time is read in it. */
  canAdd: boolean;
  /** Logs the serving a result row shows. */
  addHit: (hit: FoodSearchHit) => void;
  /** Logs the amount a Recent food was last logged with. */
  addRecent: (recent: RecentFood) => void;
};

// The serving a result row shows: the default portion, else 100 of the food's basis.
function servingOfHit(
  hit: FoodSearchHit,
  food: Food,
  portions: readonly FoodPortion[],
): LoggableAmount {
  const portion = portions.find((candidate) => candidate.id === hit.default_portion_id);

  return portion === undefined
    ? { quantity: 100, unit: food.basis === "per_100ml" ? "ml" : "g" }
    : { quantity: 1, unit: "portion", portion };
}

/**
 * The one-tap plus of the log search. A tap loads the whole food and its portions by id (a result row is
 * lean), logs the serving at the sheet's time (`openingLoggedAt` with the sheet's day and hour, read in the
 * profile's zone) and says so in a toast with an Undo, which removes only the entry that tap made. The sheet
 * stays open. A tap on a food whose last tap has not finished is ignored, so a double tap logs once. A
 * failure says that the food was not saved, and never what the amount was.
 */
export function useAddServing(context: LogContext): AddServing {
  const client = useSupabase();
  const toast = useToast();
  const logFood = useLogFood();
  const deleteEntry = useDeleteEntry();
  const isOnline = useIsOnline();
  const timeZone = useProfileTimeZone({ enabled: useReadsEnabled() }).data;
  const inFlight = useRef(new Set<string>());

  async function add(
    foodId: string,
    chooseAmount: (food: Food, portions: readonly FoodPortion[]) => LoggableAmount,
  ) {
    if (timeZone === undefined || inFlight.current.has(foodId)) {
      return;
    }
    inFlight.current.add(foodId);
    const notSaved = () => {
      toast.show({ message: SAVE_FAILED_BANNER, tone: "danger", icon: "CircleAlert" });
    };
    try {
      const [food, portions] = await Promise.all([
        getFood(client, foodId),
        listFoodPortions(client, foodId),
      ]);
      if (food === null) {
        notSaved();
        return;
      }
      const amount = chooseAmount(food, portions);
      const { loggedAt, localDate } = openingLoggedAt(new Date(), context, timeZone ?? "UTC");
      const entry = await logFood.mutateAsync({
        food,
        quantity: amount.quantity,
        unit: amount.unit,
        ...(amount.unit === "portion" ? { portion: amount.portion } : {}),
        loggedAt: loggedAt.toISOString(),
        localDate,
      });
      toast.show({
        message: describeAddedFood(food.name),
        tone: "success",
        icon: "Check",
        actionLabel: LOG_SEARCH.undo,
        onAction: () => {
          deleteEntry.mutateAsync(entry).catch(notSaved);
        },
      });
    } catch {
      // Not kept: the failure can quote the amount, which is health data.
      notSaved();
    } finally {
      inFlight.current.delete(foodId);
    }
  }

  return {
    canAdd: isOnline && timeZone !== undefined,
    addHit: (hit) => {
      void add(hit.id, (food, portions) => servingOfHit(hit, food, portions));
    },
    addRecent: (recent) => {
      void add(recent.foodId, (_food, portions) => amountLastLogged(recent, portions));
    },
  };
}
