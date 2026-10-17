import {
  getFood,
  listFoodPortions,
  useDeleteEntry,
  useLogFood,
  useLogRecipeServing,
  useSupabase,
} from "@keylow/api-client";
import { LOG_SEARCH, SAVE_FAILED_BANNER, describeAddedFood } from "@keylow/core/copy";
import { recipeAmountStart } from "@keylow/core/diary";
import { servingOfHit } from "@keylow/core/search";
import { Check, CircleAlert } from "lucide-react";
import { useRef } from "react";

import type { FoodSearchHit, LogEntry, RecipeSummary } from "@keylow/api-client";

import { useToast } from "@/components/ui/Toast";
import { useKeyboardUndo } from "@/lib/keyboardUndo";

type LoggedAt = { loggedAt: Date; localDate: string };

export type AddServing = {
  /** Logs the serving a result row shows. */
  addHit: (hit: FoodSearchHit) => void;
  /** Logs one serving of the recipe a result row shows. */
  addRecipe: (recipe: RecipeSummary) => void;
};

/**
 * The one-tap plus of the add dialog's search. A press loads the whole food and its portions by id (a result
 * row is lean), logs the serving at the dialog's time and says so in a toast with an Undo, which removes only
 * the entry that press made. The dialog stays open. A press on a food whose last press has not finished is
 * ignored, so a double press logs once. A failure says that the food was not saved, and never what the amount was.
 * A recipe's plus is the same without the load: the result row already holds what the recipe is logged from,
 * and the amount is one serving.
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
  async function addOnce(key: string, log: () => Promise<{ name: string; entry: LogEntry }>) {
    if (inFlight.current.has(key)) {
      return;
    }
    inFlight.current.add(key);
    // Asked when the press arrives, while focus is still on the plus. The dialog's focus trap keeps Tab inside
    // the dialog, so a keyboard user could not reach the toast's Undo within its wait without this route.
    const keyboardRoute = keyboardUndo.afterPressingButton();
    try {
      const { name, entry } = await log();
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
    } catch {
      // Not kept: the failure can quote the amount, which is health data.
      toast.show({ message: SAVE_FAILED_BANNER, tone: "danger", icon: CircleAlert });
    } finally {
      inFlight.current.delete(key);
    }
  }

  async function logServingOfHit(hit: FoodSearchHit) {
    const [food, portions] = await Promise.all([
      getFood(client, hit.id),
      listFoodPortions(client, hit.id),
    ]);
    if (food === null) {
      throw new Error("The food is not visible");
    }
    const amount = servingOfHit(hit, food, portions);
    const { loggedAt, localDate } = resolveLoggedAt();
    const entry = await logFood.mutateAsync({
      food,
      quantity: amount.quantity,
      unit: amount.unit,
      ...(amount.unit === "portion" ? { portion: amount.portion } : {}),
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
      void addOnce(hit.id, () => logServingOfHit(hit));
    },
    addRecipe: (recipe) => {
      void addOnce(recipe.id, () => logServingOfRecipe(recipe));
    },
  };
}
