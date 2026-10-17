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
  /**
   * Opt-in, for a card that sums something other than one food, such as the recipe editor's Per serving.
   * It becomes a named region with its own polite announcement, and a line under the macros stands in for
   * the note about the shares.
   */
  region?: MacroHeroRegion | undefined;
};

/** What turns the hero into a named region of its own: the recipe editor's Per serving card. */
export type MacroHeroRegion = {
  /** The region's accessible name, such as "Per serving". */
  name: string;
  /** A line under the macros, such as "Per 100 g cooked: 136 kcal". It stands in for the note about the shares. */
  footnote?: string | undefined;
  /** What a screen reader is told, politely, when it changes. Leave it empty while there is nothing to say. */
  announcement: string;
};

type MacroHeroFood = Pick<Food, "basis" | "kcal" | "protein_g" | "carbs_g" | "fat_g">;

/** A food's own values, or an amount of it in their place. The food detail screen passes no amount. */
export type MacroHeroFoodProps = {
  food: MacroHeroFood;
  /**
   * Opt-in, for a screen that logs an amount of the food. When it is given the hero shows these values and
   * this caption in place of the food's own basis. The food detail screen does not pass it.
   */
  amount?: MacroHeroAmount | undefined;
};

/** A card of something that is not a food, such as a recipe's Per serving: an amount with a region, and no food. */
export type MacroHeroRegionProps = {
  food?: MacroHeroFood | undefined;
  amount: MacroHeroAmount & { region: MacroHeroRegion };
};

export type MacroHeroProps =
  | { food: MacroHeroFood; amount?: undefined }
  // An amount needs no food of its own: a recipe's amount is drawn from the recipe, which is not a food.
  | { food?: MacroHeroFood | undefined; amount: MacroHeroAmount }
  | MacroHeroRegionProps;
