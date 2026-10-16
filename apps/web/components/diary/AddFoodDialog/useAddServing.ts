import {
  getFood,
  listFoodPortions,
  useDeleteEntry,
  useLogFood,
  useSupabase,
} from "@keylow/api-client";
import { LOG_SEARCH, SAVE_FAILED_BANNER, describeAddedFood } from "@keylow/core/copy";
import { servingOfHit } from "@keylow/core/search";
import { Check, CircleAlert } from "lucide-react";
import { useRef } from "react";

import type { FoodSearchHit } from "@keylow/api-client";

import { useToast } from "@/components/ui/Toast";
import { useKeyboardUndo } from "@/lib/keyboardUndo";

type LoggedAt = { loggedAt: Date; localDate: string };

/**
 * The one-tap plus of the add dialog's search. A press loads the whole food and its portions by id (a result
 * row is lean), logs the serving at the dialog's time and says so in a toast with an Undo, which removes only
 * the entry that press made. The dialog stays open. A press on a food whose last press has not finished is
 * ignored, so a double press logs once. A failure says that the food was not saved, and never what the amount was.
 */
export function useAddServing(resolveLoggedAt: () => LoggedAt): (hit: FoodSearchHit) => void {
  const client = useSupabase();
  const toast = useToast();
  const logFood = useLogFood();
  const deleteEntry = useDeleteEntry();
  const keyboardUndo = useKeyboardUndo();
  const inFlight = useRef(new Set<string>());

  async function add(hit: FoodSearchHit) {
    if (inFlight.current.has(hit.id)) {
      return;
    }
    inFlight.current.add(hit.id);
    // Asked when the press arrives, while focus is still on the plus. The dialog's focus trap keeps Tab inside
    // the dialog, so a keyboard user could not reach the toast's Undo within its wait without this route.
    const keyboardRoute = keyboardUndo.afterPressingButton();
    try {
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
      toast.show({
        message: describeAddedFood(food.name),
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
      inFlight.current.delete(hit.id);
    }
  }

  return (hit) => {
    void add(hit);
  };
}
