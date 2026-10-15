import { foodOfSnapshot } from "@keylow/core/diary";

import { amountForPicker } from "./amountLastLogged";

import type { PortionAmount } from "../components/PortionPicker";
import type { QuickAddFormValues } from "../components/QuickAddForm";
import type { FoodLogEntry, QuickLogEntry } from "@keylow/api-client";
import type { Food, FoodPortion } from "@keylow/core/schemas";

/** What the portion picker is given to draw a logged food: the food as logged, its one portion, and the amount. */
export type FoodEntryForm = {
  food: Food;
  portions: FoodPortion[];
  initialAmount: PortionAmount;
};

/**
 * The portion picker's inputs for a logged food, all from the entry's own snapshot, so changing the amount
 * recomputes from what was logged and never from the live food. The only portion on offer is the one the
 * entry was logged with. An amount in ounces is shown in grams, the units the picker has.
 */
export function foodEntryForm(entry: FoodLogEntry): FoodEntryForm {
  const { snapshot } = entry;
  const food = foodOfSnapshot(snapshot, entry.created_at);
  const loggedPortion = snapshot.unit === "portion" ? snapshot.portion : null;
  const portions: FoodPortion[] =
    loggedPortion === null
      ? []
      : [
          {
            // The portion's own id while it exists. Once it was replaced the entry holds none, and the chip needs one.
            id: entry.portion_id ?? `${entry.id}:portion`,
            food_id: snapshot.ref,
            owner_id: null,
            label: loggedPortion.label,
            grams: "grams" in loggedPortion ? loggedPortion.grams : null,
            ml: "ml" in loggedPortion ? loggedPortion.ml : null,
            is_default: true,
            position: 0,
            created_at: entry.created_at,
          },
        ];
  const [portion] = portions;
  const initialAmount: PortionAmount =
    snapshot.unit === "portion" && portion !== undefined
      ? { unit: "portion", quantity: snapshot.quantity, portion }
      : amountForPicker({
          quantity: snapshot.quantity,
          unit: snapshot.unit === "portion" ? "g" : snapshot.unit,
        });

  return { food, portions, initialAmount };
}

const numberText = (value: number | null): string => (value === null ? "" : String(value));

/** A logged quick add's saved numbers and label, as the quick add form's fields hold them. */
export function quickEntryValues(entry: QuickLogEntry): QuickAddFormValues {
  const { nutrients, snapshot } = entry;

  return {
    kcal: numberText(nutrients.kcal),
    protein: numberText(nutrients.protein_g),
    carbs: numberText(nutrients.carbs_g),
    fat: numberText(nutrients.fat_g),
    label: snapshot.label ?? "",
  };
}
