import type { Food } from "@keylow/core/schemas";

/** The energy and macros of the amount a person has chosen, in grams and kilocalories. A missing macro is null, never 0. */
export type MacroHeroAmountValues = Pick<Food, "kcal" | "protein_g" | "carbs_g" | "fat_g">;

/**
 * What the hero shows for a chosen amount in place of the food's own values: the add and edit dialogs' "For 150 g".
 * The dialog works the values out with core and hands them over, so the hero only draws them.
 */
export type MacroHeroAmount = {
  /** The basis caption, such as "For 150 g" or "For 1 medium (100 g)". */
  caption: string;
  /** The values for the amount, or null while there is no valid amount: the hero then draws dashes. */
  values: MacroHeroAmountValues | null;
  /** The food's name, written on the card's first line with the caption beside it. Leave it out where the screen already names the food. */
  name?: string | undefined;
};

export type MacroHeroProps = {
  food: Pick<Food, "basis" | "kcal" | "protein_g" | "carbs_g" | "fat_g">;
  /**
   * Opt-in, for a screen that logs or edits an amount of the food. When it is given the hero shows these
   * values and this caption in place of the food's own basis, and each share is a pill. The food detail
   * page does not pass it and is unchanged.
   */
  amount?: MacroHeroAmount | undefined;
};
