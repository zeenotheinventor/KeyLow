import { useFoodWithPortions, useLogFood } from "@keylow/api-client";
import { foodNeedsReview, pickerChoices, previewAmount, startingAmount } from "@keylow/core/diary";
import { useState } from "react";

import type { FoodWithPortionsState } from "@keylow/api-client";
import type { AmountPortion, AmountPreview, UnitOption } from "@keylow/core/diary";
import type { Food } from "@keylow/core/schemas";

type Edits = { foodId: string; quantityText?: string; unitValue?: string };

export type PortionDraft =
  | { status: "idle" }
  | Exclude<FoodWithPortionsState, { status: "ready" }>
  | {
      status: "ready";
      food: Food;
      /** Every portion an amount can be of: the food's own, then the spoons when the food is measured by volume. */
      portions: readonly AmountPortion[];
      unitOptions: UnitOption[];
      preview: AmountPreview;
      quantityText: string;
      unitValue: string;
      /** The food is flagged suspect or is missing a value, so it must be reviewed before its first log. */
      needsReview: boolean;
      isSaving: boolean;
      hasSaveError: boolean;
      setQuantityText: (text: string) => void;
      setUnitValue: (value: string) => void;
      /** Logs the amount at the instant given. Resolves true when it was saved. */
      add: (when: { loggedAt: Date; localDate: string }) => Promise<boolean>;
    };

/**
 * The portion step's state for the food chosen from the search: the food and its portions by id, the amount
 * and the unit the person has typed, and the log. The amount and the unit start from core's default serving
 * and start again for another food. The failure of a save is not kept: it can quote the amount, which is
 * health data, so the banner says what to do and nothing more.
 */
export function usePortionDraft(foodId: string | undefined): PortionDraft {
  const loaded = useFoodWithPortions(foodId ?? "");
  const logFood = useLogFood();
  const [edits, setEdits] = useState<Edits | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);

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
  const preview = previewAmount(food, choices.portions, unitValue, quantityText);

  return {
    status: "ready",
    food,
    portions: choices.portions,
    unitOptions: choices.options,
    preview,
    quantityText,
    unitValue,
    needsReview: foodNeedsReview(food),
    isSaving,
    hasSaveError,
    setQuantityText: (text) => {
      setEdits({ ...ownEdits, foodId, quantityText: text });
    },
    setUnitValue: (value) => {
      setEdits({ ...ownEdits, foodId, unitValue: value });
    },
    add: async ({ loggedAt, localDate }) => {
      const { amount } = preview;
      if (amount === null) {
        return false;
      }
      setIsSaving(true);
      setHasSaveError(false);
      try {
        await logFood.mutateAsync({
          food,
          quantity: amount.quantity,
          unit: amount.unit,
          ...(amount.unit === "portion" ? { portion: amount.portion } : {}),
          loggedAt: loggedAt.toISOString(),
          localDate,
        });
        return true;
      } catch {
        setHasSaveError(true);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
  };
}
