import { isSpoonPortionId } from "../nutrition/volume";
import {
  AMOUNT_OF_A_PORTION,
  AMOUNT_OF_THE_BASIS,
  servingOfSearchHit,
} from "../search/servingOfSearchHit";

import type { AmountFood, AmountPortion, ChosenAmount } from "./previewAmount";

/** One unit chip: the value it carries and what it says. */
export type UnitOption = { value: string; label: string };

/** The value a unit chip carries: a portion's id, or `g`, or `ml`. */
export function unitValueOf(amount: ChosenAmount): string {
  return amount.unit === "portion" ? amount.portion.id : amount.unit;
}

/**
 * Where the amount field and the chips start: the amount the screen was given, if the picker offers its
 * unit, or else the food's default serving, which is core's `servingOfSearchHit` for the food's default portion: one of that portion, or
 * 100 g (100 ml for a drink). It is the serving a result row shows and its plus logs, so the three agree.
 */
export function startingAmount(
  food: AmountFood,
  portions: readonly (AmountPortion & { is_default?: boolean })[],
  initialAmount?: ChosenAmount,
): { quantity: string; unitValue: string } {
  if (initialAmount !== undefined && isOffered(initialAmount, food, portions)) {
    return { quantity: String(initialAmount.quantity), unitValue: unitValueOf(initialAmount) };
  }
  const portion = portions.find((candidate) => candidate.is_default);
  const serving = servingOfSearchHit({
    ...food,
    default_portion_id: portion?.id ?? null,
    default_portion_label: portion?.label ?? null,
    default_portion_grams: portion?.grams ?? null,
    default_portion_ml: portion?.ml ?? null,
  });

  return { quantity: String(serving.quantity), unitValue: serving.portionId ?? serving.unit };
}

// The picker offers g always, a portion when it is on the list, and ml for a food measured by volume, which is
// a food per 100 ml or one whose spoons are on the list (see `pickerChoices`).
function isOffered(
  amount: ChosenAmount,
  food: Pick<AmountFood, "basis">,
  portions: readonly AmountPortion[],
): boolean {
  switch (amount.unit) {
    case "g":
      return true;
    case "ml":
      return food.basis === "per_100ml" || portions.some((portion) => isSpoonPortionId(portion.id));
    case "portion":
      return portions.some((portion) => portion.id === amount.portion.id);
  }
}

/**
 * The amount a unit chip starts at when it is pressed: 1 for a portion or a spoon, 100 for g or ml (the
 * amounts `startingAmount` opens on). Pressing the chip already chosen keeps the amount as it is; changing
 * to another never keeps what was typed, so no press can give 100 tbsp, 100 medium or 1 g.
 */
export function amountOnUnitChange(
  previousUnitValue: string,
  nextUnitValue: string,
  quantityText: string,
): string {
  if (nextUnitValue === previousUnitValue) {
    return quantityText;
  }

  return String(
    nextUnitValue === "g" || nextUnitValue === "ml" ? AMOUNT_OF_THE_BASIS : AMOUNT_OF_A_PORTION,
  );
}

/**
 * Where a picker stands once its chips were replaced: a refresh of a branded food deletes its portions and
 * inserts them again with new ids, so the chosen chip's id can be gone. The chip stays as it is while it is
 * still offered; otherwise the chip with the same label takes over and the typed amount is kept; otherwise
 * the picker moves to `fallbackUnitValue` (the food's default portion, or g) and the amount starts again as
 * `amountOnUnitChange` says.
 */
export function reselectUnit(
  chosen: { unitValue: string; label: string; quantityText: string },
  options: readonly UnitOption[],
  fallbackUnitValue: string,
): { unitValue: string; quantity: string } {
  const sameChip =
    options.find((option) => option.value === chosen.unitValue) ??
    options.find((option) => option.label === chosen.label);
  if (sameChip !== undefined) {
    return { unitValue: sameChip.value, quantity: chosen.quantityText };
  }

  return {
    unitValue: fallbackUnitValue,
    quantity: amountOnUnitChange(chosen.unitValue, fallbackUnitValue, chosen.quantityText),
  };
}
