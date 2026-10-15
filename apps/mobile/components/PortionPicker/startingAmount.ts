import { servingOfSearchHit } from "@keylow/core/search";

import type { PortionAmount } from "./types";
import type { ChipGroupOption } from "../ui";
import type { Food, FoodPortion } from "@keylow/core/schemas";

/** The value a unit chip carries: a portion's id, or `g`, or `ml`. */
export function unitValueOf(amount: PortionAmount): string {
  return amount.unit === "portion" ? amount.portion.id : amount.unit;
}

/**
 * The unit chips: the food's portions, then g, then ml where it applies, which is a food measured per
 * 100 ml or one that has a density.
 */
export function unitOptions(
  food: Food,
  portions: readonly FoodPortion[],
): ChipGroupOption<string>[] {
  const hasMillilitres = food.basis === "per_100ml" || food.density_g_per_ml !== null;

  return [
    ...portions.map((portion) => ({ value: portion.id, label: portion.label })),
    { value: "g", label: "g" },
    ...(hasMillilitres ? [{ value: "ml", label: "ml" }] : []),
  ];
}

/**
 * Where the amount field and the chips start: the amount the screen was given, or else the food's default
 * serving, which is core's `servingOfSearchHit` for the food's default portion: one of that portion, or
 * 100 g (100 ml for a drink). It is the serving a result row shows and its plus logs, so the three agree.
 */
export function startingAmount(
  food: Food,
  portions: readonly FoodPortion[],
  initialAmount?: PortionAmount,
): { quantity: string; unitValue: string } {
  if (initialAmount !== undefined) {
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
