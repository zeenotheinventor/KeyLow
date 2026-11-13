import { z } from "zod";

import { assistantIdSchema } from "./ids";
import {
  MAX_INGREDIENT_RESOLVED_GRAMS,
  MAX_RECIPE_INGREDIENTS,
  MAX_RECIPE_NAME_LENGTH,
  MAX_RECIPE_SERVINGS,
  MAX_RECIPE_STEPS,
  MAX_RECIPE_STEP_LENGTH,
} from "../recipes/bounds";

import type { FitMiss, FitMissReason, FitNutrient, FitResult, FitTarget } from "../recipes/fit";

/*
 * The objects here are deliberately not strict. The draft ships to phones over the air and a later change
 * adds fields to it, so an app that is behind strips what it does not know instead of failing the turn.
 * Removing or retyping a field, or adding a required one, would still fail it: the shape is additive only.
 * A value a later version adds to `change`, a miss's `reason` or a dropped food's `reason` reads as a
 * fixed fallback. `variant` and a miss's `nutrient` are final and stay strict.
 * The nutrient keys are the recipe fitter's (`FitNutrient` in `recipes/fit`), so the two cannot drift.
 */

const nameSchema = z.string().min(1).max(MAX_RECIPE_NAME_LENGTH);
const gramsSchema = z.number().nonnegative().max(MAX_INGREDIENT_RESOLVED_GRAMS);

const fitNutrientSchema = z.enum(["kcal", "protein_g", "carbs_g", "fat_g"]);

/** Each figure is null when no ingredient has data for it, never 0. */
const nullableNutrientsSchema = z.object({
  kcal: z.number().nonnegative().nullable(),
  protein_g: z.number().nonnegative().nullable(),
  carbs_g: z.number().nonnegative().nullable(),
  fat_g: z.number().nonnegative().nullable(),
});

/** One named target the draft does not meet, as the fitter judged it. */
const missSchema = z.object({
  nutrient: fitNutrientSchema,
  target: z.number().nonnegative(),
  /** Null only for `no_data`. */
  achieved: z.number().nonnegative().nullable(),
  // A reason a later version adds reads as the general one on an app that is behind, never a failed turn.
  reason: z
    .enum(["no_adjustable_ingredient", "ingredient_bounds", "targets_conflict", "no_data"])
    .catch("targets_conflict"),
  /** The names of the ingredients held at their limit, so the card can say what holds the figure back. */
  limitedBy: z.array(nameSchema).max(MAX_RECIPE_INGREDIENTS),
});

/**
 * What the draft was fitted to, per serving. `unreachable` means the misses are the closest the fitter got,
 * never a claim that the target is met.
 */
const fitSchema = z.object({
  status: z.enum(["within", "unreachable"]),
  target: z.object({
    kcal: z.number().positive().optional(),
    protein_g: z.number().nonnegative().optional(),
    carbs_g: z.number().nonnegative().optional(),
    fat_g: z.number().nonnegative().optional(),
  }),
  misses: z.array(missSchema).max(4),
});

/**
 * A line of the draft. A null `foodId` is a line that matched no food: it is shown as unmatched and left
 * out of the numbers, never invented. `beforeGrams` and a `change` other than `same` belong to an
 * adjustment. A removed ingredient has `grams` 0.
 */
const ingredientSchema = z.object({
  name: nameSchema,
  foodId: assistantIdSchema.nullable(),
  /** The matched food's own name, so the card draws it with no second lookup. Null on an unmatched line. */
  foodName: nameSchema.nullable(),
  grams: gramsSchema,
  beforeGrams: gramsSchema.nullable(),
  /** This line's kcal for the whole recipe, null when the food has no figure or the line is unmatched. */
  kcal: z.number().nonnegative().nullable(),
  // A change a later version adds reads as "changed" on an app that is behind.
  change: z.enum(["same", "changed", "added", "removed"]).catch("changed"),
});

/** A food left out because the person avoids it. */
const droppedSchema = z.object({
  name: nameSchema,
  // A reason a later version adds reads as "avoided" on an app that is behind.
  reason: z.enum(["avoided"]).catch("avoided"),
});

const draftFields = {
  name: nameSchema,
  servings: z.number().positive().max(MAX_RECIPE_SERVINGS),
  ingredients: z.array(ingredientSchema).max(MAX_RECIPE_INGREDIENTS),
  dropped: z.array(droppedSchema).max(MAX_RECIPE_INGREDIENTS),
  /** The draft as it stands (the "after" of an adjustment), computed in core from the matched foods. */
  perServing: nullableNutrientsSchema,
  /** Null when the person gave no figure to fit. */
  fit: fitSchema.nullable(),
  steps: z.array(z.string().min(1).max(MAX_RECIPE_STEP_LENGTH)).max(MAX_RECIPE_STEPS),
};

/**
 * A recipe the assistant drafted, drawn by the app under the reply. It is a read: nothing is saved until
 * the person presses Save to recipes. `suggestion` is a new recipe from `suggest_recipe`. `adjustment` is a
 * change to the recipe in `recipeId` from `adjust_recipe`, with its per-serving figures `before`.
 */
export const assistantRecipeDraftSchema = z.discriminatedUnion("variant", [
  z.object({ variant: z.literal("suggestion"), ...draftFields }),
  z.object({
    variant: z.literal("adjustment"),
    ...draftFields,
    recipeId: assistantIdSchema,
    before: nullableNutrientsSchema,
  }),
]);

export type AssistantRecipeDraft = z.infer<typeof assistantRecipeDraftSchema>;

/*
 * The fit shapes above are copies of the recipe fitter's, so the two cannot drift: this fails to compile when a
 * nutrient key, a miss's reason, the status or the shape of a target changes on one side only. The one allowed
 * difference is a miss's `limitedBy`, which the draft states as ingredient names and the fitter as food ids, and
 * both are lists of strings. Each pair has to be assignable both ways.
 */
type IsEqual<Left, Right> = [Left] extends [Right]
  ? [Right] extends [Left]
    ? true
    : false
  : false;
// A target names its nutrients as optional keys, which zod writes with `| undefined` and the fitter without, so
// they are compared by their keys and the type of each value.
type NamedNutrients<Target> = { [Nutrient in keyof Target]-?: NonNullable<Target[Nutrient]> };
type DraftFit = NonNullable<AssistantRecipeDraft["fit"]>;

type AssertTrue<Condition extends true> = Condition;

export type DraftFitMatchesTheFitter = [
  AssertTrue<IsEqual<NamedNutrients<DraftFit["target"]>, NamedNutrients<FitTarget>>>,
  AssertTrue<IsEqual<DraftFit["misses"][number], FitMiss>>,
  AssertTrue<IsEqual<DraftFit["misses"][number]["nutrient"], FitNutrient>>,
  AssertTrue<IsEqual<DraftFit["misses"][number]["reason"], FitMissReason>>,
  AssertTrue<IsEqual<DraftFit["status"], FitResult["status"]>>,
];
