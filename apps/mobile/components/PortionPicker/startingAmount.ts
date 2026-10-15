import { defaultServing } from "@keylow/core/diary";

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
 * serving, which is one of the default portion or 100 g. That is the serving a row's plus logs, so the two agree.
 */
export function startingAmount(
  food: Food,
  portions: readonly FoodPortion[],
  initialAmount?: PortionAmount,
): { quantity: string; unitValue: string } {
  if (initialAmount !== undefined) {
    return { quantity: String(initialAmount.quantity), unitValue: unitValueOf(initialAmount) };
  }
  const serving = defaultServing(food, portions);

  return {
    quantity: String(serving.quantity),
    unitValue: serving.unit === "portion" ? serving.portion.id : serving.unit,
  };
}
