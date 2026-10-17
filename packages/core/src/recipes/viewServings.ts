import { MAX_RECIPE_SERVINGS } from "./bounds";

const WHOLE_NUMBER_TEXT = /^\d+$/;
const DECIMAL_NUMBER_TEXT = /^\d+\.\d+$/;

const isWholeServings = (servings: number): boolean =>
  Number.isInteger(servings) && servings >= 1 && servings <= MAX_RECIPE_SERVINGS;

/**
 * The number of servings the recipe view's amounts should follow for what was typed into the servings
 * field, or null for a problem. The text, trimmed, is digits only and a whole number from 1 to
 * `MAX_RECIPE_SERVINGS`, or exactly the recipe's own servings (a recipe saved at 2.5 accepts "2.5" back).
 */
export const enteredViewServings = (text: string, recipeServings: number): number | null => {
  const trimmed = text.trim();
  const servings = Number(trimmed);
  if (WHOLE_NUMBER_TEXT.test(trimmed) && isWholeServings(servings)) {
    return servings;
  }

  return DECIMAL_NUMBER_TEXT.test(trimmed) && servings === recipeServings ? servings : null;
};

export type ServingsStepDirection = "plus" | "minus";

/**
 * The servings after one press of Plus or Minus, or null when the step is not allowed (the screen
 * disables the button). Plus goes up to the next whole number, up to `MAX_RECIPE_SERVINGS`; Minus goes
 * down to the next whole number, down to 1. So 4 gives 5 and 3, and 2.5 gives 3 and 2.
 */
export const stepViewServings = (
  value: number,
  direction: ServingsStepDirection,
): number | null => {
  const next = direction === "plus" ? Math.floor(value) + 1 : Math.ceil(value) - 1;

  return isWholeServings(next) ? next : null;
};
