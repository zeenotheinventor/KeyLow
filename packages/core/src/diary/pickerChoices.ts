import { SPOON_PORTIONS, canMeasureByVolume } from "../nutrition/volume";

import type { AmountPortion } from "./previewAmount";
import type { UnitOption } from "./startingAmount";
import type { SpoonPortion } from "../nutrition/volume";
import type { Food, FoodPortion } from "../schemas/food";

/** The part of a food the picker's chips depend on. */
export type PickerFood = Pick<
  Food,
  "basis" | "source" | "source_ref" | "food_group" | "density_g_per_ml"
>;

/**
 * What the portion picker works from, made together so a caller cannot give `previewAmount` a different
 * list than the chips came from: `portions` is every portion an amount can be of (the food's own, and
 * the spoons when the food is measured by volume), and `options` are the chips made from it.
 */
export type PickerChoices<Portion extends AmountPortion = AmountPortion> = {
  portions: (Portion | SpoonPortion)[];
  options: UnitOption[];
};

const GRAMS_OPTION: UnitOption = { value: "g", label: "g" };
const MILLILITRES_OPTION: UnitOption = { value: "ml", label: "ml" };

/**
 * The chips for portions the food already has: those portions in the order given, then g, and, when the
 * food is measured by volume, ml and the teaspoon and tablespoon. A chip says its words only ("1 medium",
 * "1 tbsp"); the sizes are in the hero's caption.
 */
export function choicesFor<Portion extends AmountPortion>(
  ownPortions: readonly Portion[],
  isMeasuredByVolume: boolean,
): PickerChoices<Portion> {
  const spoons = isMeasuredByVolume ? SPOON_PORTIONS : [];

  return {
    portions: [...ownPortions, ...spoons],
    options: [
      ...ownPortions.map((portion) => ({ value: portion.id, label: portion.label })),
      GRAMS_OPTION,
      ...(isMeasuredByVolume ? [MILLILITRES_OPTION] : []),
      ...spoons.map((spoon) => ({ value: spoon.id, label: spoon.label })),
    ],
  };
}

/**
 * The picker's chips for a food and its portions, in this order: the food's own portions by `position`
 * (the default one is the one the picker opens on, not necessarily the first), then g, then, only when the
 * food can be measured by volume, ml, 1 tsp and 1 tbsp. A food that cannot gets no volume chip at all. A
 * food measured by volume can have its density from a portion's label, such as "1 tbsp (15 g)".
 * Read the starting amount from `portions`, which holds the spoons that the chips name.
 */
export function pickerChoices<Portion extends AmountPortion & Pick<FoodPortion, "position">>(
  food: PickerFood,
  portions: readonly Portion[],
): PickerChoices<Portion> {
  const inOrder = [...portions].sort((first, second) => first.position - second.position);

  return choicesFor(inOrder, canMeasureByVolume(food, portions));
}
