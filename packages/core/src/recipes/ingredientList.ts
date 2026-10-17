/*
 * The ingredient list of a recipe draft: ingredients in the order they are listed. Every operation
 * returns a new list and leaves the one it was given alone. An index outside the list throws a
 * `RangeError`, because the editors only ever pass an index they drew. A message states the rule and
 * never an ingredient, which is health data.
 */
import { MAX_RECIPE_INGREDIENTS } from "./bounds";

import type { RecipeIngredient } from "./schemas";

const isPlace = (index: number, length: number): boolean =>
  Number.isInteger(index) && index >= 0 && index < length;

const assertIngredientIndex = (ingredients: readonly RecipeIngredient[], index: number): void => {
  if (!isPlace(index, ingredients.length)) {
    throw new RangeError("The ingredient index must be a whole number within the list");
  }
};

const assertRoomForAnother = (ingredients: readonly RecipeIngredient[]): void => {
  if (ingredients.length >= MAX_RECIPE_INGREDIENTS) {
    throw new RangeError(`A recipe has at most ${MAX_RECIPE_INGREDIENTS} ingredients`);
  }
};

/** Adds an ingredient at the end of the list. */
export const addIngredient = (
  ingredients: readonly RecipeIngredient[],
  ingredient: RecipeIngredient,
): RecipeIngredient[] => {
  assertRoomForAnother(ingredients);
  return [...ingredients, ingredient];
};

/** Replaces the ingredient at `index`. */
export const replaceIngredient = (
  ingredients: readonly RecipeIngredient[],
  index: number,
  ingredient: RecipeIngredient,
): RecipeIngredient[] => {
  assertIngredientIndex(ingredients, index);
  return ingredients.map((existing, place) => (place === index ? ingredient : existing));
};

/** Removes the ingredient at `index`. */
export const removeIngredient = (
  ingredients: readonly RecipeIngredient[],
  index: number,
): RecipeIngredient[] => {
  assertIngredientIndex(ingredients, index);
  return ingredients.filter((_, place) => place !== index);
};

/**
 * Puts a removed ingredient back at its old place, for Undo. The place may be the length of the list,
 * where the last ingredient was. A full list has no room for it, so at 100 ingredients, removing one,
 * adding another and then Undo throws a `RangeError`: the editor must catch it, or not offer Undo then.
 */
export const restoreIngredient = (
  ingredients: readonly RecipeIngredient[],
  index: number,
  ingredient: RecipeIngredient,
): RecipeIngredient[] => {
  if (!isPlace(index, ingredients.length + 1)) {
    throw new RangeError(
      "The place for an ingredient must be a whole number within or at the end of the list",
    );
  }
  assertRoomForAnother(ingredients);
  return [...ingredients.slice(0, index), ingredient, ...ingredients.slice(index)];
};
