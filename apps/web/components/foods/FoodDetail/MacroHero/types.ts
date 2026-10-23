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
  /**
   * The id of a note under the card that says more about the amount, such as which grams a recipe's are of.
   * It becomes the group's accessible description. The note stays real text on the page.
   */
  describedBy?: string | undefined;
  /**
   * Opt-in, for a card that sums something other than one food, such as the recipe editor's Per serving. It
   * becomes a named region with its own polite announcement and a line under the macros in place of the
   * shares note, and the macros are rows at every width.
   */
  region?: MacroHeroRegion | undefined;
};

/** What turns the hero into a named region of its own: the recipe editor's Per serving card. */
export type MacroHeroRegion = {
  /** The region's accessible name, such as "Per serving". */
  name: string;
  /** A line under the macros, such as "Per 100 g cooked: 136 kcal". It stands in for the note about the shares. */
  footnote?: string | undefined;
  /** What a screen reader hears when it changes, in a polite live region. Leave it empty while there is nothing to say. */
  announcement: string;
};

type MacroHeroFood = Pick<Food, "basis" | "kcal" | "protein_g" | "carbs_g" | "fat_g">;

/** A food's own values, or an amount of it in their place. The food page passes no amount and is unchanged. */
export type MacroHeroFoodProps = {
  food: MacroHeroFood;
  /**
   * Opt-in, for a screen that logs or edits an amount of the food. When it is given the hero shows these
   * values and this caption in place of the food's own basis, and each share is a pill.
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
  | { food?: MacroHeroFood | undefined; amount: MacroHeroAmount }
  | MacroHeroRegionProps;
