import {
  recipeComputedSchema,
  recipeSchema,
  refreshRecipeIngredients,
  storedRecipeIngredientSchema,
} from "@keylow/core/recipes";
import { z } from "zod";

import { idOfRow, parseRow } from "./diaryRows";
import { escapeLikePattern } from "./escapeLikePattern";
import { MIN_SEARCH_LENGTH, getFood, listFoodPortions } from "./foods";

import type { Database } from "../database.types";
import type {
  RefreshableFoods,
  RefreshedRecipeIngredients,
  StoredRecipeIngredient,
} from "@keylow/core/recipes";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// A recipe is health data, and the database's own message and details can quote a failing row. So a
// failure here names the action and the error code only, and the cause holds the code and nothing
// else. A row that does not parse is reported by its id and the paths of the fields that failed.

export const LIBRARY_COLUMNS = "id,name,servings,yield_grams,is_archived,computed";
const INGREDIENT_COLUMNS = "position,food_id,quantity,unit,portion_id,resolved_grams,snapshot";
const RECIPE_COLUMNS = `${LIBRARY_COLUMNS},instructions,recipe_ingredients(${INGREDIENT_COLUMNS})`;

const DEFAULT_SEARCH_LIMIT = 25;
const MAX_SEARCH_LIMIT = 50;

export const recipeRepoError = (action: string, cause: PostgrestError) =>
  new Error(`Could not ${action} (${cause.code})`, { cause: { code: cause.code } });

const recipeSummarySchema = recipeSchema
  .pick({ name: true, servings: true, yield_grams: true, is_archived: true })
  .extend({ id: z.guid(), computed: recipeComputedSchema });

const recipeDetailSchema = recipeSchema
  .extend({
    id: z.guid(),
    computed: recipeComputedSchema,
    recipe_ingredients: z.array(storedRecipeIngredientSchema),
  })
  .transform(({ recipe_ingredients, ...recipe }) => ({
    ...recipe,
    ingredients: recipe_ingredients,
  }));

/** One recipe as the library lists it: the lean columns and the `computed` nutrition cache. */
export type RecipeSummary = z.infer<typeof recipeSummarySchema>;

/**
 * One recipe with everything its screen shows. `ingredients` are in list order (`position` from 0) and
 * `instructions` are the steps in order, the first element being step 1.
 */
export type RecipeDetail = z.infer<typeof recipeDetailSchema>;

export type RecipeListOptions = {
  /**
   * False, the default, lists live recipes only. True lists archived recipes as well as live ones, and
   * each row says which it is in `is_archived`.
   */
  archived?: boolean;
};

export type RecipeSearchOptions = RecipeListOptions & {
  /** How many recipes to ask for, 1 to 50. Defaults to 25. */
  limit?: number;
};

export const recipeSummaryOf = (row: unknown, action: string): RecipeSummary =>
  parseRow(recipeSummarySchema, row, action, idOfRow);

const summariesOf = (rows: readonly unknown[], action: string): RecipeSummary[] =>
  rows.map((row) => recipeSummaryOf(row, action));

/**
 * The signed in user's recipe library, by name and then id (ADR 0003, Amendment 8). Row level security
 * shows a user their own recipes only, so no owner is passed. The `computed` cache comes with each
 * recipe, and the ingredients and steps do not.
 */
export async function listRecipes(
  client: SupabaseClient<Database>,
  { archived = false }: RecipeListOptions = {},
): Promise<RecipeSummary[]> {
  const query = client.from("recipes").select(LIBRARY_COLUMNS);
  const { data, error } = await (archived ? query : query.eq("is_archived", false))
    .order("name", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw recipeRepoError("load your recipes", error);
  }

  return summariesOf(data, "load your recipes");
}

/**
 * One recipe with its ingredients in `position` order and its steps. An archived recipe is returned
 * like a live one. Null when the recipe is not visible to the user, which is the same for an id that
 * does not exist and for another user's.
 */
export async function getRecipe(
  client: SupabaseClient<Database>,
  id: string,
): Promise<RecipeDetail | null> {
  const { data, error } = await client
    .from("recipes")
    .select(RECIPE_COLUMNS)
    .eq("id", id)
    .order("position", { ascending: true, referencedTable: "recipe_ingredients" })
    .maybeSingle();

  if (error) {
    throw recipeRepoError("load the recipe", error);
  }

  return data === null ? null : parseRow(recipeDetailSchema, data, "load the recipe", idOfRow);
}

/**
 * The user's recipes whose name contains `query`, ignoring case, in the library's order. This is an
 * `ilike` over the caller's own rows through PostgREST (ADR 0003, Amendment 8), with `%` and `_` in
 * the query escaped so they match literally (a `*` is the exception, see `escapeLikePattern`). A
 * query shorter than `MIN_SEARCH_LENGTH` once trimmed is answered with no recipes and no request.
 * `limit` is kept between 1 and 50.
 */
export async function searchRecipes(
  client: SupabaseClient<Database>,
  query: string,
  { archived = false, limit = DEFAULT_SEARCH_LIMIT }: RecipeSearchOptions = {},
): Promise<RecipeSummary[]> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < MIN_SEARCH_LENGTH) {
    return [];
  }

  const matching = client
    .from("recipes")
    .select(LIBRARY_COLUMNS)
    .ilike("name", `%${escapeLikePattern(trimmedQuery)}%`);
  const { data, error } = await (archived ? matching : matching.eq("is_archived", false))
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .limit(Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.trunc(limit))));

  if (error) {
    throw recipeRepoError("search your recipes", error);
  }

  return summariesOf(data, "search your recipes");
}

/**
 * What "Refresh ingredients" would change, as core works it out (`refreshRecipeIngredients`): the new
 * ingredient rows, the recipe's totals before and after, and what changed for each ingredient.
 */
export type RecipeRefreshDiff = RefreshedRecipeIngredients<StoredRecipeIngredient>;

const errorCodeOf = (error: unknown): string =>
  error instanceof Error &&
  typeof error.cause === "object" &&
  error.cause !== null &&
  "code" in error.cause &&
  typeof error.cause.code === "string"
    ? error.cause.code
    : "unknown";

/**
 * Reads every distinct food of the recipe once, with its portions, all in flight together. The food
 * read is `getFood`, which does not filter on `deleted_at` (ADR 0003, Amendment 2), so a food that was
 * soft deleted since still arrives, and core reports it as gone. A food the user cannot see is left
 * out of the map, which core treats the same way. A failed read fails them all: a diff over some of the
 * foods would show a recipe as unchanged when it was not looked at. The foods' own errors quote the
 * database's message, so a failure is reported by the action and the code only.
 */
async function readFoodsOf(
  client: SupabaseClient<Database>,
  ingredients: readonly StoredRecipeIngredient[],
): Promise<RefreshableFoods> {
  const foodIds = [...new Set(ingredients.map(({ food_id }) => food_id))];
  try {
    const found = await Promise.all(
      foodIds.map(async (id) => {
        const [food, portions] = await Promise.all([
          getFood(client, id),
          listFoodPortions(client, id),
        ]);
        return food === null ? null : ([id, { food, portions }] as const);
      }),
    );
    return new Map(found.filter((entry) => entry !== null));
  } catch (error) {
    throw new Error(`Could not load the foods of the recipe (${errorCodeOf(error)})`, {
      cause: { code: errorCodeOf(error) },
    });
  }
}

/**
 * Reads a recipe and the current food of each ingredient, and works out the refresh. Null when the
 * recipe is not visible to the user. This only reads: it is what the preview shows and what an apply
 * saves, so the two cannot disagree about what a refresh is.
 */
export async function readRecipeRefresh(
  client: SupabaseClient<Database>,
  recipeId: string,
): Promise<{ recipe: RecipeDetail; diff: RecipeRefreshDiff } | null> {
  const recipe = await getRecipe(client, recipeId);
  if (recipe === null) {
    return null;
  }

  const foods = await readFoodsOf(client, recipe.ingredients);
  const diff = refreshRecipeIngredients({
    servings: recipe.servings,
    yieldGrams: recipe.yield_grams,
    ingredients: recipe.ingredients,
    foods,
  });
  return { recipe, diff };
}

/**
 * The before and after of "Refresh ingredients" for one recipe, without writing anything. Each
 * ingredient is compared with its food as it is now, and a food that changed only in a portion does
 * not count (as for a diary entry). Null when the recipe is not visible to the user.
 */
export async function previewRecipeRefresh(
  client: SupabaseClient<Database>,
  recipeId: string,
): Promise<RecipeRefreshDiff | null> {
  return (await readRecipeRefresh(client, recipeId))?.diff ?? null;
}
