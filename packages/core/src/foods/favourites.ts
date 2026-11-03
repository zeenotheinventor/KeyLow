/**
 * Live favourites one person holds, foods and recipes together, because one strip shows both. The
 * `food_favourites` and `recipe_favourites` triggers in the database enforce the same number, so the
 * three must change together. A favourite whose food is soft deleted, or whose recipe is archived, is
 * not counted.
 */
export const MAX_FAVOURITES = 30;
