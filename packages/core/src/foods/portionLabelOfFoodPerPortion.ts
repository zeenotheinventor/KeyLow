import type { Food } from "../schemas/food";

/**
 * The label of a food per portion's one portion, "1 bucket", which the screens put into "per bucket". It is
 * the default portion's, else the first. Undefined for a food measured by weight, which needs no label, and
 * for a food per portion whose portions are not known yet, which reads "per portion".
 */
export function portionLabelOfFoodPerPortion(
  food: Pick<Food, "basis">,
  portions: readonly { label: string; is_default?: boolean }[],
): string | undefined {
  if (food.basis !== "per_portion") {
    return undefined;
  }

  return (portions.find((portion) => portion.is_default === true) ?? portions[0])?.label;
}
