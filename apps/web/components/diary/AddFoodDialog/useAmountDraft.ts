import { useFoodWithPortions } from "@keylow/api-client";
import {
  amountOnUnitChange,
  foodNeedsReview,
  pickerChoices,
  previewAmount,
  startingAmount,
} from "@keylow/core/diary";
import { useState } from "react";

import type { FoodWithPortionsState } from "@keylow/api-client";
import type { AmountPortion, AmountPreview, UnitOption } from "@keylow/core/diary";
import type { Food } from "@keylow/core/schemas";

type Edits = { foodId: string; quantityText?: string; unitValue?: string };

/** The amount step once its food has loaded: what the person has typed and what that comes to. */
export type ReadyAmountDraft = {
  status: "ready";
  food: Food;
  /** Every portion an amount can be of: the food's own, then the spoons when the food is measured by volume. */
  portions: readonly AmountPortion[];
  unitOptions: UnitOption[];
  preview: AmountPreview;
  quantityText: string;
  unitValue: string;
  /** The food is flagged suspect or is missing a value, so it must be reviewed before its first use. */
  needsReview: boolean;
  setQuantityText: (text: string) => void;
  setUnitValue: (value: string) => void;
};

export type AmountDraft =
  { status: "idle" } | Exclude<FoodWithPortionsState, { status: "ready" }> | ReadyAmountDraft;

/**
 * The amount step's state for the food chosen from the search: the food and its portions by id, and the
 * amount and the unit the person has typed. The amount and the unit start from core's default serving and
 * start again for another food. It writes nothing: the diary logs the amount and the recipe editor adds it
 * to its draft.
 */
export function useAmountDraft(foodId: string | undefined): AmountDraft {
  const loaded = useFoodWithPortions(foodId ?? "");
  const [edits, setEdits] = useState<Edits | undefined>(undefined);

  if (foodId === undefined) {
    return { status: "idle" };
  }
  if (loaded.status !== "ready") {
    return loaded;
  }

  const { food } = loaded;
  // The chips and the amount are worked out from the one list, so a chip can never name a portion the preview lacks.
  const choices = pickerChoices(food, loaded.portions);
  const start = startingAmount(food, choices.portions);
  const ownEdits = edits?.foodId === foodId ? edits : undefined;
  const quantityText = ownEdits?.quantityText ?? start.quantity;
  const unitValue = ownEdits?.unitValue ?? start.unitValue;

  return {
    status: "ready",
    food,
    portions: choices.portions,
    unitOptions: choices.options,
    preview: previewAmount(food, choices.portions, unitValue, quantityText),
    quantityText,
    unitValue,
    needsReview: foodNeedsReview(food),
    setQuantityText: (text) => {
      setEdits({ ...ownEdits, foodId, quantityText: text });
    },
    setUnitValue: (value) => {
      setEdits({
        ...ownEdits,
        foodId,
        unitValue: value,
        quantityText: amountOnUnitChange(unitValue, value, quantityText),
      });
    },
  };
}
