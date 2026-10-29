/*
 * The numbers of ADR 0003, Amendment 15 ("The numbers"). The migration writes the same ones into its
 * checks and into `save_shopping_items`. If they ever differ, the ADR table wins.
 */

/** Characters in an item's name, counted as the database counts them (code points). */
export const MAX_SHOPPING_ITEM_NAME_LENGTH = 200;

/** An item's grams, when it has them, are above 0 and at most this. */
export const MAX_SHOPPING_ITEM_GRAMS = 100000;

/** Characters in an item's portion label. */
export const MAX_SHOPPING_PORTION_LABEL_LENGTH = 200;

/** An item's count of portions, when it has one, is above 0 and at most this. */
export const MAX_SHOPPING_PORTION_COUNT = 10000;

/** The recipes one item names as where it came from. */
export const MAX_SHOPPING_ITEM_SOURCES = 50;

/** The items one call of `save_shopping_items` writes. */
export const MAX_SHOPPING_ITEMS_PER_SAVE = 500;
