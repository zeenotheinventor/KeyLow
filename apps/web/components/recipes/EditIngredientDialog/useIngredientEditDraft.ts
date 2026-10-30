import { useFoodWithPortions, useRefreshOutdatedOffFood } from "@keylow/api-client";
import {
  entryPickerChoices,
  amountOnUnitChange,
  previewAmount,
  reselectPickedUnit,
  snapshotAmountStart,
  snapshotAsFood,
} from "@keylow/core/diary";
import { withAmount } from "@keylow/core/recipes";
import { useState } from "react";

import type { AmountFood, AmountPortion, AmountPreview, UnitOption } from "@keylow/core/diary";
import type { RecipeIngredient } from "@keylow/core/recipes";

/** `unitLabel` is the words on the chip pressed, which finds it again when a refresh of the food gives its portions new ids. */
type Edits = { quantityText?: string; unitValue?: string; unitLabel?: string };

export type IngredientEditDraft = {
  /** The ingredient's own food values, so the hero and the chips come from what it was added with. */
  food: AmountFood;
  portions: readonly AmountPortion[];
  unitOptions: UnitOption[];
  preview: AmountPreview;
  quantityText: string;
  unitValue: string;
  setQuantityText: (text: string) => void;
  setUnitValue: (value: string) => void;
  /** The ingredient with the amount typed, or null while the amount is not a number above 0. */
  result: RecipeIngredient | null;
};

/**
 * The edit dialog's state for one ingredient: its amount, worked out from the ingredient's own snapshot and
 * never from the live food. The live food only adds its portions to the chips, where they still match.
 * An amount left as it was gives the ingredient back as it is, so Save changes nothing.
 */
export function useIngredientEditDraft(ingredient: RecipeIngredient): IngredientEditDraft {
  const loaded = useFoodWithPortions(ingredient.food_id);
  // An old branded food asks for its refresh. Only the chips follow it: the ingredient keeps its own snapshot.
  useRefreshOutdatedOffFood(
    loaded.status === "ready" && loaded.food.deleted_at === null ? loaded.food : undefined,
  );
  const [edits, setEdits] = useState<Edits>({});
  const { snapshot } = ingredient;

  // The food's portions are offered only while the food is there to take them from.
  const live =
    loaded.status === "ready" && loaded.food.deleted_at === null
      ? { portions: loaded.portions, loggedPortionId: ingredient.portion_id }
      : undefined;
  const food = snapshotAsFood(snapshot);
  const choices = entryPickerChoices(snapshot, live);
  const start = snapshotAmountStart(snapshot);
  // A chip pressed before a refresh of the food landed is found again by its label, with the amount kept.
  const picked = reselectPickedUnit(
    edits.unitValue === undefined
      ? undefined
      : {
          unitValue: edits.unitValue,
          label: edits.unitLabel ?? "",
          quantityText: edits.quantityText ?? start.quantity,
        },
    choices.options,
    start.unitValue,
  );
  const quantityText = picked?.quantity ?? edits.quantityText ?? start.quantity;
  const unitValue = picked?.unitValue ?? start.unitValue;
  const labelOf = (value: string) =>
    choices.options.find((option) => option.value === value)?.label ?? "";
  const preview = previewAmount(food, choices.portions, unitValue, quantityText);
  const isAmountChanged = quantityText !== start.quantity || unitValue !== start.unitValue;

  return {
    food,
    portions: choices.portions,
    unitOptions: choices.options,
    preview,
    quantityText,
    unitValue,
    setQuantityText: (text) => {
      setEdits({
        ...(picked === undefined
          ? {}
          : { unitValue: picked.unitValue, unitLabel: labelOf(picked.unitValue) }),
        quantityText: text,
      });
    },
    setUnitValue: (value) => {
      setEdits({
        unitValue: value,
        unitLabel: labelOf(value),
        quantityText: amountOnUnitChange(unitValue, value, quantityText),
      });
    },
    result:
      preview.amount === null
        ? null
        : isAmountChanged
          ? withAmount(ingredient, preview.amount)
          : ingredient,
  };
}
