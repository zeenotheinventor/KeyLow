import { z } from "zod";

import {
  MAX_INGREDIENT_RESOLVED_GRAMS,
  MAX_RECIPE_NAME_LENGTH,
  MAX_RECIPE_SERVINGS,
  MAX_RECIPE_STEPS,
  MAX_RECIPE_STEP_LENGTH,
  MAX_RECIPE_YIELD_GRAMS,
} from "./bounds";
import { characterCount } from "./characterCount";
import { foodSnapshotSchema } from "../diary/schemas";
import { NUTRITION_ENGINE_VERSION } from "../diary/versions";
import { quantityUnitSchema } from "../nutrition/units";
import { nutrientsSchema } from "../schemas/nutrients";

const rowIdSchema = z.guid();

const isNotBlank = (text: string): boolean => text.trim() !== "";

const textOfAtMost = (maximumLength: number) =>
  z
    .string()
    .refine(isNotBlank, { message: "Text must not be blank" })
    .refine((text) => characterCount(text) <= maximumLength, {
      message: `Text must be at most ${maximumLength} characters`,
    });

/**
 * The part of a `recipes` row that a person writes (ADR 0003, Amendment 8): the bounds are row rules, so
 * a stored recipe satisfies them as well as a typed one. The steps are an ordered list, the first
 * element is step 1. The id, owner and `computed` cache are not here, the cache has its own schema.
 */
export const recipeSchema = z.object({
  name: textOfAtMost(MAX_RECIPE_NAME_LENGTH),
  servings: z.number().positive().max(MAX_RECIPE_SERVINGS),
  /** Null means no measured cooked weight. */
  yield_grams: z.number().positive().max(MAX_RECIPE_YIELD_GRAMS).nullable(),
  instructions: z.array(textOfAtMost(MAX_RECIPE_STEP_LENGTH)).max(MAX_RECIPE_STEPS),
  is_archived: z.boolean(),
});

const ingredientFields = {
  food_id: rowIdSchema,
  quantity: z.number().positive(),
  unit: quantityUnitSchema,
  /** Set only for a portion that is a table row, so a spoon has none. */
  portion_id: rowIdSchema.nullable(),
  resolved_grams: z.number().positive().max(MAX_INGREDIENT_RESOLVED_GRAMS),
  snapshot: foodSnapshotSchema,
};

type IngredientColumns = {
  food_id: string;
  quantity: number;
  unit: string;
  portion_id: string | null;
  resolved_grams: number;
  snapshot: z.infer<typeof foodSnapshotSchema>;
};

/**
 * The columns of an ingredient repeat its snapshot, and core builds both from the same snapshot. A
 * portion link is only for the portion unit (Amendment 2), and a spoon has none.
 */
const withIngredientRules = <Ingredient extends IngredientColumns>(
  schema: z.ZodType<Ingredient>,
): z.ZodType<Ingredient> =>
  schema
    .refine(
      (ingredient) =>
        ingredient.food_id === ingredient.snapshot.ref &&
        ingredient.quantity === ingredient.snapshot.quantity &&
        ingredient.unit === ingredient.snapshot.unit &&
        ingredient.resolved_grams === ingredient.snapshot.resolvedGrams,
      { message: "The ingredient columns must agree with its snapshot" },
    )
    .refine((ingredient) => ingredient.unit === "portion" || ingredient.portion_id === null, {
      message: "A portion link is only allowed for the portion unit",
      path: ["portion_id"],
    });

/**
 * One ingredient as `save_recipe` takes it: a food, an amount and the snapshot that froze the food
 * when it was added. `position` is not here because the database assigns it from the array index.
 */
export const recipeIngredientSchema = withIngredientRules(z.object(ingredientFields));

/** An ingredient as read back from `recipe_ingredients`, in list order from position 0. */
export const storedRecipeIngredientSchema = withIngredientRules(
  z.object({ ...ingredientFields, position: z.number().int().nonnegative() }),
);

/**
 * `recipes.computed`: the cache `computeRecipe` writes with the recipe. `perServing` and `per100g` keep
 * a null as null, and `per100g` is all null when `effectiveGrams` is 0.
 */
export const recipeComputedSchema = z.object({
  total: nutrientsSchema,
  perServing: nutrientsSchema,
  per100g: nutrientsSchema,
  /** The sum of the ingredients' `resolved_grams`. */
  totalGrams: z.number().nonnegative(),
  /** The yield when the recipe has one, otherwise `totalGrams`. */
  effectiveGrams: z.number().nonnegative(),
  engineVersion: z.number().int().positive().max(NUTRITION_ENGINE_VERSION),
});

export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;
export type StoredRecipeIngredient = z.infer<typeof storedRecipeIngredientSchema>;
export type RecipeComputed = z.infer<typeof recipeComputedSchema>;
