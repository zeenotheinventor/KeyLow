import { normaliseSteps } from "./steps";
import { enteredNumber, fieldText } from "../diary/rules/enteredNumber";

import type { Recipe, RecipeIngredient } from "./schemas";
import type { RecipeDraft } from "./validateRecipeDraft";

/** A recipe as the editor reads it back: what `useRecipe` returns, of which only these fields matter. */
export type StoredRecipe = Pick<Recipe, "name" | "servings" | "yield_grams" | "instructions"> & {
  /** In list order. A stored row also has a `position`, which a draft does not keep. */
  ingredients: readonly RecipeIngredient[];
};

/** The columns that make an ingredient what it is. A stored row's `position` is left behind. */
const ingredientOf = (ingredient: RecipeIngredient): RecipeIngredient => ({
  food_id: ingredient.food_id,
  quantity: ingredient.quantity,
  unit: ingredient.unit,
  portion_id: ingredient.portion_id,
  resolved_grams: ingredient.resolved_grams,
  snapshot: ingredient.snapshot,
});

/** A stored recipe as the text of its fields: a null yield is a blank cooked weight. */
export const recipeDraftOf = (recipe: StoredRecipe): RecipeDraft => ({
  name: recipe.name,
  servings: String(recipe.servings),
  cookedWeight: fieldText(recipe.yield_grams),
  ingredients: recipe.ingredients.map(ingredientOf),
  steps: [...recipe.instructions],
});

/** An empty draft. A new recipe starts at 1 serving and has no cooked weight until one is measured. */
export const newRecipeDraft = (name: string = ""): RecipeDraft => ({
  name,
  servings: "1",
  cookedWeight: "",
  ingredients: [],
  steps: [],
});

/** Two readings of a field are the same number, or both are not a number at all. */
const sameNumber = (first: number | null, second: number | null): boolean =>
  first === second || (Number.isNaN(first) && Number.isNaN(second));

const sameSteps = (saved: readonly string[], current: readonly string[]): boolean => {
  const savedSteps = normaliseSteps(saved);
  const currentSteps = normaliseSteps(current);
  return (
    savedSteps.length === currentSteps.length &&
    savedSteps.every((step, place) => step === currentSteps[place])
  );
};

/**
 * The same food, the same amount (down to the portion) and the same unit. The snapshot is not compared, so
 * picking the same food, amount and unit again after the food's nutrients changed reads as no change.
 */
const sameIngredient = (first: RecipeIngredient, second: RecipeIngredient): boolean =>
  first.food_id === second.food_id &&
  first.quantity === second.quantity &&
  first.unit === second.unit &&
  first.portion_id === second.portion_id &&
  first.resolved_grams === second.resolved_grams;

const sameIngredients = (
  saved: readonly RecipeIngredient[],
  current: readonly RecipeIngredient[],
): boolean =>
  saved.length === current.length &&
  saved.every((ingredient, place) => {
    const other = current[place];
    return other !== undefined && sameIngredient(ingredient, other);
  });

/**
 * Whether the current draft means something other than the saved one, for the discard prompt. It compares
 * what the draft says and not how it was typed: the name trimmed, servings and cooked weight as the
 * numbers they read as (so "4" and "4.0" are the same, and so are a blank and a blank), the steps as
 * `normaliseSteps` leaves them (so a blank step nobody typed into is nothing), and the ingredients in
 * order by food, amount and unit.
 */
export const isRecipeDraftChanged = (saved: RecipeDraft, current: RecipeDraft): boolean =>
  saved.name.trim() !== current.name.trim() ||
  !sameNumber(enteredNumber(saved.servings), enteredNumber(current.servings)) ||
  !sameNumber(enteredNumber(saved.cookedWeight), enteredNumber(current.cookedWeight)) ||
  !sameSteps(saved.steps, current.steps) ||
  !sameIngredients(saved.ingredients, current.ingredients);
