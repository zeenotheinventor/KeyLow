import { z } from "zod";

import { MAX_RECIPE_NAME_LENGTH } from "../recipes/bounds";
import { toleranceOf } from "../recipes/fit";

import type { FitNutrient, FitTarget } from "../recipes/fit";
import type { NullableNutrients } from "../schemas/nutrients";

/*
 * A saved recipe `adjust_recipe` could not change to what was asked (`assistant-card · recipe-compare`, refused):
 * scaling its own ingredients and adding foods of the person's got no closer. The card says what a serving
 * reaches against what was asked, and that no new recipe was made. Core works the figures out, and the card only
 * words them (`describeRecipeRefusal`).
 *
 * Not strict, so a field a later version adds is stripped by an app that is behind. The tool sends this as
 * `structured.recipeRefusal`, the turn loop stores it in the tool result's `display` and streams it as a
 * `recipe_refusal` event.
 */
export const assistantRecipeRefusalSchema = z.object({
  recipeName: z.string().min(1).max(MAX_RECIPE_NAME_LENGTH),
  /** The figure the person asked to change. */
  nutrient: z.enum(["kcal", "protein_g", "carbs_g", "fat_g"]),
  /** What a serving was asked to come to: calories, or grams of `nutrient`. */
  target: z.number().nonnegative(),
  /** The closest the recipe's ingredients got, in the same unit as `target`. */
  reached: z.number().nonnegative(),
  /** The calories a serving comes to at that point, or null unless they are what was asked to be held and still are, within the fit's tolerance. */
  reachedKcal: z.number().nonnegative().nullable(),
});

export type AssistantRecipeRefusal = z.infer<typeof assistantRecipeRefusalSchema>;

type RecipeRefusalInput = {
  recipeName: string;
  nutrient: FitNutrient;
  /** What a serving was asked to come to, from `adjustmentTarget`. */
  target: FitTarget;
  /** The closest figures the fit reached, per serving. */
  reached: Pick<NullableNutrients, FitNutrient>;
};

/**
 * The refusal the card draws, or null when it has nothing true to say: the target has no figure for what was
 * asked, or no ingredient has a figure for it.
 */
export function recipeRefusalOf({
  recipeName,
  nutrient,
  target,
  reached,
}: RecipeRefusalInput): AssistantRecipeRefusal | null {
  const wanted = target[nutrient];
  const closest = reached[nutrient];
  if (wanted === undefined || closest === null) {
    return null;
  }
  // "Near its 389 kcal" is only true when the calories the fit held are still met, so otherwise it is left out.
  const heldKcal = target.kcal;
  const isKcalHeld =
    nutrient !== "kcal" &&
    heldKcal !== undefined &&
    reached.kcal !== null &&
    Math.abs(reached.kcal - heldKcal) <= toleranceOf("kcal", heldKcal);
  return {
    recipeName: recipeName.slice(0, MAX_RECIPE_NAME_LENGTH),
    nutrient,
    target: wanted,
    reached: closest,
    reachedKcal: isKcalHeld ? reached.kcal : null,
  };
}
