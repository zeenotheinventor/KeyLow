import type { Food } from "@keylow/core/schemas";

/** The energy and macros of the amount a person has chosen, in grams and kilocalories. A missing macro is null, never 0. */
export type MacroHeroAmountValues = Pick<Food, "kcal" | "protein_g" | "carbs_g" | "fat_g">;

/**
 * What the hero shows for a chosen amount in place of the food's own values: the portion picker's "For 150 g".
 * The screen works the values out with core and hands them over, so the hero only draws them.
 */
export type MacroHeroAmount = {
  /** The basis caption beside the energy, such as "For 150 g" or "For 1 medium (100 g)". */
  caption: string;
  /** The values for the amount, or null while there is no valid amount: the hero then draws dashes. */
  values: MacroHeroAmountValues | null;
};

export type MacroHeroProps = {
  food: Pick<Food, "basis" | "kcal" | "protein_g" | "carbs_g" | "fat_g">;
  /**
   * Opt-in, for a screen that logs an amount of the food. When it is given the hero shows these values and
   * this caption in place of the food's own basis. The food detail screen does not pass it.
   */
  amount?: MacroHeroAmount | undefined;
};
