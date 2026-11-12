import { estimatedPortion } from "./estimatedPortion";

import type { CustomFoodInput, Food } from "../schemas/food";

type PortionInput = CustomFoodInput["portions"][number];

/**
 * The portions a custom food is saved with, so it always opens on one that is not grams. A food with no
 * default among its portions gets its first portion as the default, and a food with no portions gets one
 * estimate from its energy (an own food has no category). A default the person chose is kept.
 */
export function withDefaultPortion(
  food: Pick<Food, "basis" | "kcal">,
  portions: readonly PortionInput[],
): PortionInput[] {
  const [first, ...rest] = portions;
  if (first === undefined) {
    const { label, grams, ml } = estimatedPortion({ basis: food.basis, kcal: food.kcal });
    return [
      {
        label,
        ...(grams === null ? {} : { grams }),
        ...(ml === null ? {} : { ml }),
        isDefault: true,
      },
    ];
  }
  if (portions.some((portion) => portion.isDefault)) {
    return [...portions];
  }
  return [{ ...first, isDefault: true }, ...rest];
}
