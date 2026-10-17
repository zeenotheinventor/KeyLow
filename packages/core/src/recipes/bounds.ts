/*
 * The numbers of ADR 0003, Amendment 8 ("The numbers"). The migration (KEY-283) writes the same ones
 * into its checks and into `save_recipe`. If they ever differ, the ADR table wins.
 */

/** Characters in a recipe name, counted as the database counts them (code points, not UTF-16 units). */
export const MAX_RECIPE_NAME_LENGTH = 200;

/** Servings are above 0 and at most this. Fractions are allowed. */
export const MAX_RECIPE_SERVINGS = 1000;

/** The cooked weight of a recipe, when it has one, is above 0 and at most this. */
export const MAX_RECIPE_YIELD_GRAMS = 100000;

/** Instruction steps in a recipe. */
export const MAX_RECIPE_STEPS = 50;

/** Characters in one instruction step. */
export const MAX_RECIPE_STEP_LENGTH = 1000;

/** Ingredients in a recipe. */
export const MAX_RECIPE_INGREDIENTS = 100;

/** The grams one ingredient resolves to are above 0 and at most this. */
export const MAX_INGREDIENT_RESOLVED_GRAMS = 100000;
