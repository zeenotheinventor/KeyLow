import {
  MAX_RECIPE_INGREDIENTS,
  computeRecipe,
  normaliseSteps,
  recipeIngredientSchema,
  recipeSchema,
} from "@keylow/core/recipes";
import { z } from "zod";

import { isDeadPortionRefusal } from "./deadPortion";
import {
  LIBRARY_COLUMNS,
  getRecipe,
  readRecipeRefresh,
  recipeRepoError,
  recipeSummaryOf,
} from "./recipes";

import type { RecipeDetail, RecipeRefreshDiff, RecipeSummary } from "./recipes";
import type { Database } from "../database.types";
import type { RecipeIngredient } from "@keylow/core/recipes";
import type { Json } from "@keylow/db";
import type { SupabaseClient } from "@supabase/supabase-js";

// The recipe writes. A recipe is health data, so a failure here names the action and the error code
// only, as the reads do, and a check that fails before a request names the fields and never a value.

/**
 * What a save sends: the values `validateRecipeDraft` cleans, and the ingredient rows built by
 * `buildRecipeIngredient`. There is no `computed` here. The repo computes the cache from the
 * ingredients itself, so a caller cannot save one that disagrees with them.
 */
export type RecipeSave = {
  name: string;
  servings: number;
  /** Null when the recipe has no cooked weight. */
  yieldGrams: number | null;
  /** In list order. A row read back from a recipe, with its `position`, is accepted too. */
  ingredients: readonly RecipeIngredient[];
  /** In order, the first being step 1. Trimmed, and blank ones dropped, before the save. */
  steps: readonly string[];
};

export type RecipeUpdate = RecipeSave & {
  /** The recipe to replace. */
  id: string;
};

export type DuplicateRecipeInput = {
  recipeId: string;
  /** The name of the copy. The wording of "copy" is screen copy, so the caller chooses it. */
  name: string;
};

// The checks are core's own schemas, so the repo refuses before any request what the database would
// refuse. Every ingredient is parsed before `computeRecipe` or the save sees it: the builder allows a
// quantity of 0 that the schema refuses, and a hand-made row with a negative quantity would otherwise
// reach core's `RangeError`, which quotes the amount.
const recipeSaveSchema = z.object({
  name: recipeSchema.shape.name,
  servings: recipeSchema.shape.servings,
  yieldGrams: recipeSchema.shape.yield_grams,
  steps: recipeSchema.shape.instructions,
  ingredients: z.array(recipeIngredientSchema).max(MAX_RECIPE_INGREDIENTS),
});

/** A `RangeError` with the paths of the fields that failed. A Zod error is not attached, because its issues can quote the value. */
const invalidRecipe = (paths: readonly string[]) =>
  new RangeError(`The recipe is not valid at ${[...new Set(paths)].join(", ")}`);

function checkedSave(save: RecipeSave) {
  const result = recipeSaveSchema.safeParse({ ...save, steps: normaliseSteps(save.steps) });
  if (!result.success) {
    throw invalidRecipe(result.error.issues.map(({ path }) => path.join(".") || "(recipe)"));
  }
  return result.data;
}

/**
 * Calls `save_recipe` (ADR 0003, Amendment 8). The generated type of its first argument is a plain
 * `string`, because Postgres cannot give it a default ahead of the arguments after it, but the function
 * creates the recipe when it is null. This is the one place that says so, so no call site needs a cast.
 */
function callSaveRecipe(
  client: SupabaseClient<Database>,
  recipeId: string | null,
  recipe: Json,
  ingredients: Json,
) {
  const args: Database["public"]["Functions"]["save_recipe"]["Args"] = {
    p_recipe_id: recipeId as string,
    p_recipe: recipe,
    p_ingredients: ingredients,
  };
  return client.rpc("save_recipe", args);
}

/**
 * The ingredients with no portion on the ones whose portion no longer exists (a refresh of a branded food
 * replaces its portions), or null when there is nothing to change: no ingredient has a portion, every portion
 * is still there, or the portions could not be read. The snapshot of an ingredient keeps its label and amount.
 */
async function withoutDeadPortions(
  client: SupabaseClient<Database>,
  ingredients: readonly RecipeIngredient[],
): Promise<RecipeIngredient[] | null> {
  const portionIds = [
    ...new Set(ingredients.flatMap(({ portion_id }) => (portion_id === null ? [] : [portion_id]))),
  ];
  if (portionIds.length === 0) {
    return null;
  }

  const { data, error } = await client.from("food_portions").select("id").in("id", portionIds);
  if (error) {
    return null;
  }

  const livePortionIds = new Set(data.map(({ id }) => id));
  if (portionIds.every((portionId) => livePortionIds.has(portionId))) {
    return null;
  }

  return ingredients.map((ingredient) =>
    ingredient.portion_id === null || livePortionIds.has(ingredient.portion_id)
      ? ingredient
      : { ...ingredient, portion_id: null },
  );
}

/**
 * The one way a recipe is written, for a new recipe (`recipeId` null) and for a replaced one: a single
 * `save_recipe` call writes the recipe, its ingredients, its steps and its cache, or none of them. The
 * recipe is read back afterwards, so what is returned is what the database stored.
 */
async function saveRecipe(
  client: SupabaseClient<Database>,
  recipeId: string | null,
  save: RecipeSave,
): Promise<RecipeDetail> {
  const { name, servings, yieldGrams, steps, ingredients } = checkedSave(save);

  const recipe = {
    name,
    servings,
    yield_grams: yieldGrams,
    instructions: steps,
    computed: computeRecipe({ servings, yieldGrams, ingredients }),
  };

  let saved = await callSaveRecipe(client, recipeId, recipe, ingredients);

  // A refusal for a portion that is gone is saved again once, with no portion on the ingredients that lost it.
  if (saved.error && isDeadPortionRefusal(saved.error)) {
    const withoutDead = await withoutDeadPortions(client, ingredients);
    if (withoutDead !== null) {
      saved = await callSaveRecipe(client, recipeId, recipe, withoutDead);
    }
  }

  const { data: savedId, error } = saved;

  if (error) {
    throw recipeRepoError("save the recipe", error);
  }

  const stored = await getRecipe(client, savedId);
  if (stored === null) {
    throw new Error("Could not load the recipe after saving it");
  }
  return stored;
}

/**
 * Creates a recipe for the signed in user and resolves to it as stored. The database chooses the id. See
 * `RecipeSave`. A value the database would refuse throws a `RangeError` before any request.
 */
export function createRecipe(
  client: SupabaseClient<Database>,
  save: RecipeSave,
): Promise<RecipeDetail> {
  return saveRecipe(client, null, save);
}

/**
 * Replaces the name, servings, yield, ingredients, steps and totals of the caller's recipe, all or
 * nothing, and resolves to it as stored. Two devices saving at once is last save wins, with no check
 * for a change since the recipe was read, as for custom foods. A recipe that does not exist, or is
 * not the caller's (the two look the same), fails with the code P0002. The archived flag is not
 * touched.
 */
export function updateRecipe(
  client: SupabaseClient<Database>,
  { id, ...save }: RecipeUpdate,
): Promise<RecipeDetail> {
  return saveRecipe(client, id, save);
}

/**
 * Archives a recipe, or brings it back with `archived` false. This is a plain update of one column,
 * and the ingredients are not touched. It resolves to the recipe as stored. A recipe that is not the
 * caller's matches no row, and that fails with the code PGRST116.
 */
export async function setRecipeArchived(
  client: SupabaseClient<Database>,
  id: string,
  archived: boolean,
): Promise<RecipeSummary> {
  const action = archived ? "archive the recipe" : "restore the recipe";
  const { data, error } = await client
    .from("recipes")
    .update({ is_archived: archived })
    .eq("id", id)
    .select(LIBRARY_COLUMNS)
    .single();

  if (error) {
    throw recipeRepoError(action, error);
  }

  return recipeSummaryOf(data, action);
}

/**
 * Saves a copy of a recipe under the given name and resolves to it. The copy has a new id, is not
 * archived, and carries the servings, the yield, the steps and the ingredient rows exactly as they
 * are stored, so frozen values stay frozen: nothing here refreshes an ingredient from its food. The
 * totals are computed from those rows like for any save. The copy is one `save_recipe` call. A recipe
 * that does not exist or is not the caller's fails with P0002, the code the database uses for it.
 */
export async function duplicateRecipe(
  client: SupabaseClient<Database>,
  { recipeId, name }: DuplicateRecipeInput,
): Promise<RecipeDetail> {
  if (!recipeSchema.shape.name.safeParse(name).success) {
    throw invalidRecipe(["name"]);
  }

  const original = await getRecipe(client, recipeId);
  if (original === null) {
    throw new Error("Could not duplicate the recipe (P0002)", { cause: { code: "P0002" } });
  }

  return saveRecipe(client, null, {
    name,
    servings: original.servings,
    yieldGrams: original.yield_grams,
    ingredients: original.ingredients,
    steps: original.instructions,
  });
}

/**
 * Applies "Refresh ingredients": reads the recipe and its foods as they are now, rebuilds the
 * ingredients whose food changed, and saves them with the new totals in one `save_recipe` call, all or
 * nothing. It resolves to the diff it applied, so a screen shows what was written, and if a food changed
 * since the preview that is the newer diff. Nothing is written when no food changed, so a refresh never
 * overwrites a recipe it did not need to change. Last save wins, with no check for a change since the
 * recipe was read, as for any save. Nothing in the diary is touched: an entry keeps its frozen figures.
 * A recipe that does not exist or is not the caller's fails with P0002, the code the database uses for it.
 */
export async function applyRecipeRefresh(
  client: SupabaseClient<Database>,
  recipeId: string,
): Promise<RecipeRefreshDiff> {
  const refresh = await readRecipeRefresh(client, recipeId);
  if (refresh === null) {
    throw new Error("Could not refresh the recipe's ingredients (P0002)", {
      cause: { code: "P0002" },
    });
  }

  const { recipe, diff } = refresh;
  if (diff.hasChanges) {
    await saveRecipe(client, recipe.id, {
      name: recipe.name,
      servings: recipe.servings,
      yieldGrams: recipe.yield_grams,
      ingredients: diff.ingredients,
      steps: recipe.instructions,
    });
  }
  return diff;
}
