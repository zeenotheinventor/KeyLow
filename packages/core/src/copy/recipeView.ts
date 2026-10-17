import { describeServingSuffix } from "./recipeLog";
import { describeSpokenGrams } from "./recipeWording";
import { formatScaledCount } from "../format/scaledCount";
import { MAX_RECIPE_SERVINGS } from "../recipes/bounds";

/**
 * The recipe view's own words (brief 25). Its title is the recipe's name, Back is `FOOD_FORM.back`, More
 * is `DIARY_MORE_LABEL`, the stepper's label is `RECIPE_EDITOR.servings`, the section headings are
 * `RECIPE_EDITOR.ingredients` and `.instructions`, and the offline banner's title is `OFFLINE_BANNER.title`.
 */
export const RECIPE_VIEW = {
  /** The label of the web button. The mobile icon is named by `describeEditRecipe`. */
  edit: "Edit",
  /** Under the servings field for blank, 0, 1001 or a fraction. The 1,000 is `MAX_RECIPE_SERVINGS`. */
  servingsProblem: `Enter whole servings from 1 to ${formatScaledCount(MAX_RECIPE_SERVINGS)}.`,
  fewerServings: "Fewer servings",
  moreServings: "More servings",
  offlineBody: "You can read and scale this recipe. Changes need a connection.",
};

/** The name of the Edit icon: "Edit Chicken and rice". */
export const describeEditRecipe = (recipeName: string): string => `Edit ${recipeName}`;

/** A number of servings with its unit: "6 servings", "2.5 servings", and "1 serving" only for exactly 1. */
export const describeServingsValue = (servings: number): string =>
  `${formatScaledCount(servings)} ${describeServingSuffix(servings)}`;

/** The Reset link, which puts the recipe's own servings back: "Back to 4 servings". */
export const describeResetServings = (recipeServings: number): string =>
  `Back to ${describeServingsValue(recipeServings)}`;

/** Over the ingredients, following the stepper: "For 4 servings". */
export const describeIngredientsFor = (servings: number): string =>
  `For ${describeServingsValue(servings)}`;

/** Under the Instructions heading once scaled: "The steps are written for 4 servings." */
export const describeStepsServingsNote = (recipeServings: number): string =>
  `The steps are written for ${describeServingsValue(recipeServings)}.`;

/**
 * What a screen reader is told, politely, after the servings change: "Ingredients for 6 servings, 1,650
 * grams cooked", or "Ingredients for 6 servings" when the recipe has no cooked weight. The cooked weight is
 * in whole grams, as the yield line writes it.
 */
export const describeServingsAnnouncement = (
  servings: number,
  cookedGrams: number | null,
): string =>
  cookedGrams === null
    ? `Ingredients for ${describeServingsValue(servings)}`
    : `Ingredients for ${describeServingsValue(servings)}, ${describeSpokenGrams(Math.round(cookedGrams))} cooked`;
