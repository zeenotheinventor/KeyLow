import { useFoodWithPortions, useRefreshOutdatedOffFood } from "@keylow/api-client";
import {
  amountOnUnitChange,
  foodNeedsReview,
  pickerChoices,
  previewAmount,
  reselectPickedUnit,
  startingAmount,
} from "@keylow/core/diary";
import { useState } from "react";

import type { FoodWithPortionsState } from "@keylow/api-client";
import type { AmountPortion, AmountPreview, UnitOption } from "@keylow/core/diary";
import type { Food } from "@keylow/core/schemas";

/** `unitLabel` is the words on the chip pressed, which finds it again when a refresh of the food gives its portions new ids. */
type Edits = { foodId: string; quantityText?: string; unitValue?: string; unitLabel?: string };

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
  // An old branded food asks for its refresh, so the portions it has gained since appear as chips.
  useRefreshOutdatedOffFood(loaded.status === "ready" ? loaded.food : undefined);
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
  // A chip pressed before a refresh of the food landed is found again by its label, with the amount kept.
  const picked = reselectPickedUnit(
    ownEdits?.unitValue === undefined
      ? undefined
      : {
          unitValue: ownEdits.unitValue,
          label: ownEdits.unitLabel ?? "",
          quantityText: ownEdits.quantityText ?? start.quantity,
        },
    choices.options,
    start.unitValue,
  );
  const quantityText = picked?.quantity ?? ownEdits?.quantityText ?? start.quantity;
  const unitValue = picked?.unitValue ?? start.unitValue;
  const labelOf = (value: string) =>
    choices.options.find((option) => option.value === value)?.label ?? "";
  // The unit and amount the dialog opened on are kept from the first render of this food, so a refresh that
  // makes another portion the default does not move an untouched dialog, or re-read a typed amount in another unit.
  if (ownEdits === undefined) {
    setEdits({
      foodId,
      unitValue: start.unitValue,
      unitLabel: labelOf(start.unitValue),
      quantityText: start.quantity,
    });
  }

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
      setEdits({
        ...ownEdits,
        foodId,
        ...(picked === undefined
          ? {}
          : { unitValue: picked.unitValue, unitLabel: labelOf(picked.unitValue) }),
        quantityText: text,
      });
    },
    setUnitValue: (value) => {
      setEdits({
        ...ownEdits,
        foodId,
        unitValue: value,
        unitLabel: labelOf(value),
        quantityText: amountOnUnitChange(unitValue, value, quantityText),
      });
    },
  };
}
