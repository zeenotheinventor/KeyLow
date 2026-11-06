import {
  getFood,
  listFoodPortions,
  useDeleteEntry,
  useLogFood,
  useLogRecipeServing,
  useSupabase,
} from "@keylow/api-client";
import {
  FOOD_NOT_FOUND,
  LOG_SEARCH,
  SAVE_FAILED_BANNER,
  describeAddedFood,
} from "@keylow/core/copy";
import { amountLastLogged, foodNeedsReview, recipeAmountStart } from "@keylow/core/diary";
import { servingOfHit } from "@keylow/core/search";
import { Check, CircleAlert } from "lucide-react";
import { useRef } from "react";

import type { FoodSearchHit, LogEntry, RecentFood, RecipeSummary } from "@keylow/api-client";
import type { LoggableAmount } from "@keylow/core/diary";
import type { Food, FoodPortion } from "@keylow/core/schemas";

import { useToast } from "@/components/ui/Toast";
import { useKeyboardUndo } from "@/lib/keyboardUndo";

type LoggedAt = { loggedAt: Date; localDate: string };

// The food a plus was pressed for is gone or hidden from this person, such as a deleted food a stale list still shows.
class FoodNotVisibleError extends Error {}

export type AddServing = {
  /** Logs the serving a result row shows. */
  addHit: (hit: FoodSearchHit) => void;
  /**
   * Logs the amount a Recent row shows, the one the food was last logged with. A food that now needs review
   * is not logged: `onNeedsReview` is called instead, to open its portion step, which says what to do.
   */
  addRecent: (recent: RecentFood, onNeedsReview: () => void) => void;
  /** Logs one serving of the recipe a result row shows. */
  addRecipe: (recipe: RecipeSummary) => void;
};

/**
 * The one-tap plus of the add dialog's search. A press loads the whole food and its portions by id (a result
 * row is lean), logs the serving at the dialog's time and says so in a toast with an Undo, which removes only
 * the entry that press made. The dialog stays open. A press on a food whose last press has not finished is
 * ignored, so a double press logs once. A failure says that the food was not saved, and never what the amount was.
 * A Recent row's plus logs the amount the food was last logged with, as `amountLastLogged` finds it on the
 * food as it is now. A recipe's plus is the same without the load: the result row already holds what the
 * recipe is logged from, and the amount is one serving.
 */
export function useAddServing(resolveLoggedAt: () => LoggedAt): AddServing {
  const client = useSupabase();
  const toast = useToast();
  const logFood = useLogFood();
  const logRecipe = useLogRecipeServing();
  const deleteEntry = useDeleteEntry();
  const keyboardUndo = useKeyboardUndo();
  const inFlight = useRef(new Set<string>());

  // Runs one press's logging, unless the last press on the same row has not finished. `log` resolves to the
  // name and the stored entry for the toast.
  // A `log` that resolves to nothing has logged nothing and has nothing to say.
  async function addOnce(
    key: string,
    log: () => Promise<{ name: string; entry: LogEntry } | undefined>,
  ) {
    if (inFlight.current.has(key)) {
      return;
    }
    inFlight.current.add(key);
    // Asked when the press arrives, while focus is still on the plus. The dialog's focus trap keeps Tab inside
    // the dialog, so a keyboard user could not reach the toast's Undo within its wait without this route.
    const keyboardRoute = keyboardUndo.afterPressingButton();
    try {
      const logged = await log();
      if (logged === undefined) {
        return;
      }
      const { name, entry } = logged;
      toast.show({
        message: describeAddedFood(name),
        tone: "success",
        icon: Check,
        actionLabel: LOG_SEARCH.undo,
        onAction: () => {
          deleteEntry.mutateAsync(entry).catch(() => {
            toast.show({ message: LOG_SEARCH.undoFailed, tone: "danger", icon: CircleAlert });
          });
        },
        ...keyboardRoute(),
      });
    } catch (error) {
      // Not kept: the failure can quote the amount, which is health data. A food that is gone is not a
      // connection problem, so it does not say to check the connection.
      toast.show({
        message: error instanceof FoodNotVisibleError ? FOOD_NOT_FOUND.body : SAVE_FAILED_BANNER,
        tone: "danger",
        icon: CircleAlert,
      });
    } finally {
      inFlight.current.delete(key);
    }
  }

  // Loads the whole food and its portions by id, then logs the amount `amountOf` works out from them. With
  // `onNeedsReview`, a food that needs review is not logged and the callback is called instead.
  async function logAmountOfFood(
    foodId: string,
    amountOf: (food: Food, portions: FoodPortion[]) => LoggableAmount,
    onNeedsReview?: () => void,
  ) {
    const [food, portions] = await Promise.all([
      getFood(client, foodId),
      listFoodPortions(client, foodId),
    ]);
    // `getFood` also returns a deleted food, and a list that was read earlier can still show one.
    if (food === null || food.deleted_at !== null) {
      throw new FoodNotVisibleError("The food is not visible");
    }
    if (onNeedsReview !== undefined && foodNeedsReview(food)) {
      onNeedsReview();
      return undefined;
    }
    const amount = amountOf(food, portions);
    const { loggedAt, localDate } = resolveLoggedAt();
    const entry = await logFood.mutateAsync({
      food,
      quantity: amount.quantity,
      unit: amount.unit,
      ...(amount.unit === "portion" ? { portion: amount.portion } : {}),
      foodPortions: portions,
      loggedAt: loggedAt.toISOString(),
      localDate,
    });

    return { name: food.name, entry };
  }

  async function logServingOfRecipe(recipe: RecipeSummary) {
    const { loggedAt, localDate } = resolveLoggedAt();
    const entry = await logRecipe.mutateAsync({
      recipe,
      ...recipeAmountStart(),
      loggedAt: loggedAt.toISOString(),
      localDate,
    });

    return { name: recipe.name, entry };
  }

  return {
    addHit: (hit) => {
      void addOnce(hit.id, () =>
        logAmountOfFood(hit.id, (food, portions) => servingOfHit(hit, food, portions)),
      );
    },
    addRecent: (recent, onNeedsReview) => {
      void addOnce(recent.foodId, () =>
        logAmountOfFood(
          recent.foodId,
          (_food, portions) => amountLastLogged(recent, portions),
          onNeedsReview,
        ),
      );
    },
    addRecipe: (recipe) => {
      void addOnce(recipe.id, () => logServingOfRecipe(recipe));
    },
  };
}
