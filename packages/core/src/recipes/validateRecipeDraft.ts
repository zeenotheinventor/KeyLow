import {
  MAX_RECIPE_INGREDIENTS,
  MAX_RECIPE_NAME_LENGTH,
  MAX_RECIPE_SERVINGS,
  MAX_RECIPE_STEPS,
  MAX_RECIPE_STEP_LENGTH,
  MAX_RECIPE_YIELD_GRAMS,
} from "./bounds";
import { recipeIngredientSchema } from "./schemas";
import { normaliseSteps } from "./steps";
import { enteredNumber } from "../diary/rules/enteredNumber";

import type { RecipeIngredient } from "./schemas";
import type { ValidationResult } from "../diary/rules/validation";

/** What a recipe editor holds before Save. The numbers are the text of their fields. */
export type RecipeDraft = {
  name: string;
  servings: string;
  /** Blank means the recipe has no cooked weight. */
  cookedWeight: string;
  ingredients: readonly RecipeIngredient[];
  steps: readonly string[];
};

/**
 * Everything a draft can get wrong, as a closed union so a screen can map each code to its own sentence
 * with an exhaustive `switch`. A code says what is wrong and never carries what was typed.
 */
export type RecipeDraftProblem =
  | "name_required"
  | "name_too_long"
  | "servings_invalid"
  | "servings_too_many"
  | "cooked_weight_invalid"
  | "cooked_weight_too_large"
  | "ingredients_none"
  | "ingredients_too_many"
  | "ingredient_invalid"
  | "steps_too_many"
  | "step_too_long";

/** A draft with no problems, cleaned: the values `computeRecipe` takes, and what Save sends. */
export type CleanRecipeDraft = {
  /** Trimmed. */
  name: string;
  servings: number;
  /** Null when the cooked weight was left blank. */
  yieldGrams: number | null;
  /** Trimmed, with the blank steps dropped. */
  steps: string[];
};

/** Characters as the database counts them: code points, so an emoji is one and not two. */
const characterCount = (text: string): number => Array.from(text).length;

type NumberProblem = "invalid" | "too_large" | null;

const problemWithAmount = (amount: number | null, maximum: number): NumberProblem => {
  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    return "invalid";
  }
  return amount > maximum ? "too_large" : null;
};

const nameProblems = (name: string): RecipeDraftProblem[] => {
  if (name === "") {
    return ["name_required"];
  }
  return characterCount(name) > MAX_RECIPE_NAME_LENGTH ? ["name_too_long"] : [];
};

const servingsProblems = (servings: number | null): RecipeDraftProblem[] => {
  const problem = problemWithAmount(servings, MAX_RECIPE_SERVINGS);
  if (problem === "invalid") {
    return ["servings_invalid"];
  }
  return problem === "too_large" ? ["servings_too_many"] : [];
};

/** A blank cooked weight is no yield, so only a number that was typed can be a problem. */
const cookedWeightProblems = (cookedWeight: number | null): RecipeDraftProblem[] => {
  if (cookedWeight === null) {
    return [];
  }
  const problem = problemWithAmount(cookedWeight, MAX_RECIPE_YIELD_GRAMS);
  if (problem === "invalid") {
    return ["cooked_weight_invalid"];
  }
  return problem === "too_large" ? ["cooked_weight_too_large"] : [];
};

/**
 * The count is checked, and so is every ingredient against `recipeIngredientSchema`: the builder allows
 * an amount of 0 so an editor can preview it, and the schema is what refuses it for saving.
 */
const ingredientProblems = (ingredients: readonly RecipeIngredient[]): RecipeDraftProblem[] => {
  const problems: RecipeDraftProblem[] = [];
  if (ingredients.length === 0) {
    problems.push("ingredients_none");
  }
  if (ingredients.length > MAX_RECIPE_INGREDIENTS) {
    problems.push("ingredients_too_many");
  }
  if (!ingredients.every((ingredient) => recipeIngredientSchema.safeParse(ingredient).success)) {
    problems.push("ingredient_invalid");
  }
  return problems;
};

/** The steps are counted as they will be saved: trimmed, and without the blank ones. */
const stepProblems = (steps: readonly string[]): RecipeDraftProblem[] => {
  const problems: RecipeDraftProblem[] = [];
  if (steps.length > MAX_RECIPE_STEPS) {
    problems.push("steps_too_many");
  }
  if (steps.some((step) => characterCount(step) > MAX_RECIPE_STEP_LENGTH)) {
    problems.push("step_too_long");
  }
  return problems;
};

/**
 * Whether a recipe is ready to save. The problems come back as codes in field order (name, servings,
 * cooked weight, ingredients, steps), each at most once, and never with the text that was typed. The
 * numbers are read with `enteredNumber`, so "12,5" is 12.5 and "1,200" is not a number. With no
 * problems it returns the cleaned values.
 */
export const validateRecipeDraft = (
  draft: RecipeDraft,
): ValidationResult<CleanRecipeDraft, readonly RecipeDraftProblem[]> => {
  const name = draft.name.trim();
  const servings = enteredNumber(draft.servings);
  const yieldGrams = enteredNumber(draft.cookedWeight);
  const steps = normaliseSteps(draft.steps);

  const problems = [
    ...nameProblems(name),
    ...servingsProblems(servings),
    ...cookedWeightProblems(yieldGrams),
    ...ingredientProblems(draft.ingredients),
    ...stepProblems(steps),
  ];
  // Blank servings is already a problem, so the null check here only narrows the type.
  if (problems.length > 0 || servings === null) {
    return { ok: false, problems };
  }
  return { ok: true, value: { name, servings, yieldGrams, steps } };
};
