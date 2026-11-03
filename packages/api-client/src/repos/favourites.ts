import { foodRowSchema } from "@keylow/core/schemas";
import { z } from "zod";

import { FavouriteRuleError } from "../errors";
import { FOOD_COLUMNS } from "./foods";
import { LIBRARY_COLUMNS, recipeSummaryOf } from "./recipes";

import type { Database } from "../database.types";
import type { RecipeSummary } from "./recipes";
import type { Food } from "@keylow/core/schemas";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// What a person favourites is health data. A failure here names the action and the error code only,
// and the cause holds the code and nothing else. A row that does not parse is reported by its action
// alone, because the issues of a parse can quote the value that failed.

/** The error code the database raises when a person already holds 30 live favourites, foods and recipes together. */
const FAVOURITE_LIMIT_CODE = "KL004";

const favouriteRepoError = (action: string, cause: PostgrestError) =>
  new Error(`Could not ${action} (${cause.code})`, { cause: { code: cause.code } });

const favouriteRowSchema = z.object({
  created_at: z.iso.datetime({ offset: true }),
  foods: foodRowSchema,
});

/** A favourite food: the food as it is now, and when it was favourited. */
export type FavouriteFood = {
  foodId: string;
  createdAt: string;
  food: Food;
};

/**
 * The foods the signed in user has favourited, newest first. Row level security shows a user their
 * own favourites only, so no owner is passed. A soft deleted food is left out, and comes back once the
 * food is restored. A person holds at most 30, so the list is not paged.
 */
export async function listFavouriteFoods(
  client: SupabaseClient<Database>,
): Promise<FavouriteFood[]> {
  const { data, error } = await client
    .from("food_favourites")
    .select(`created_at, foods!inner(${FOOD_COLUMNS})`)
    .is("foods.deleted_at", null)
    .order("created_at", { ascending: false })
    .order("food_id", { ascending: false });

  if (error) {
    throw favouriteRepoError("load the favourite foods", error);
  }

  return data.map((row) => {
    const parsed = favouriteRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new Error("Could not read the favourite foods: a row has an unexpected shape");
    }
    return {
      foodId: parsed.data.foods.id,
      createdAt: parsed.data.created_at,
      food: parsed.data.foods,
    };
  });
}

/**
 * Favourites a food. Favouriting a food that is already a favourite changes nothing and is not an
 * error. A person holds at most `MAX_FAVOURITES` live favourites, foods and recipes together: the
 * database refuses one more, and this throws a `FavouriteRuleError` with the rule `favourite_limit`. A food the
 * caller cannot see, or that is soft deleted, is refused by the table's policy and fails with its
 * code (42501), so a soft deleted food that is already a favourite cannot be favourited again until
 * it is restored.
 */
export async function addFavouriteFood(
  client: SupabaseClient<Database>,
  foodId: string,
): Promise<void> {
  const action = "favourite the food";

  const { error } = await client
    .from("food_favourites")
    .upsert({ food_id: foodId }, { onConflict: "owner_id,food_id", ignoreDuplicates: true });

  if (error) {
    if (error.code === FAVOURITE_LIMIT_CODE) {
      throw new FavouriteRuleError(action, "favourite_limit");
    }
    throw favouriteRepoError(action, error);
  }
}

/** Removes a food from the favourites. A food that is not a favourite matches no row and is not an error. */
export async function removeFavouriteFood(
  client: SupabaseClient<Database>,
  foodId: string,
): Promise<void> {
  const { error } = await client.from("food_favourites").delete().eq("food_id", foodId);

  if (error) {
    throw favouriteRepoError("unfavourite the food", error);
  }
}

const favouriteRecipeRowSchema = z.object({
  created_at: z.iso.datetime({ offset: true }),
  recipes: z.unknown(),
});

/** A favourite recipe: the recipe as the library lists it now, and when it was favourited. */
export type FavouriteRecipe = {
  recipeId: string;
  createdAt: string;
  recipe: RecipeSummary;
};

/**
 * The recipes the signed in user has favourited, newest first. Row level security shows a user their
 * own favourites only, so no owner is passed. An archived recipe is left out, and comes back once the
 * recipe is restored. A person holds at most 30 favourites, so the list is not paged.
 */
export async function listFavouriteRecipes(
  client: SupabaseClient<Database>,
): Promise<FavouriteRecipe[]> {
  const action = "load the favourite recipes";

  const { data, error } = await client
    .from("recipe_favourites")
    .select(`created_at, recipes!inner(${LIBRARY_COLUMNS})`)
    .eq("recipes.is_archived", false)
    .order("created_at", { ascending: false })
    .order("recipe_id", { ascending: false });

  if (error) {
    throw favouriteRepoError(action, error);
  }

  return data.map((row) => {
    const parsed = favouriteRecipeRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new Error(`Could not read the favourite recipes: a row has an unexpected shape`);
    }
    const recipe = recipeSummaryOf(parsed.data.recipes, action);
    return { recipeId: recipe.id, createdAt: parsed.data.created_at, recipe };
  });
}

/**
 * Favourites a recipe. Favouriting a recipe that is already a favourite changes nothing and is not an
 * error. The cap of `MAX_FAVOURITES` is shared with the favourite foods: the database refuses one more,
 * and this throws a `FavouriteRuleError` with the rule `favourite_limit`. A recipe the caller cannot
 * see, or that is archived, is refused by the table's policy and fails with its code (42501), so an
 * archived recipe that is already a favourite cannot be favourited again until it is restored.
 */
export async function addFavouriteRecipe(
  client: SupabaseClient<Database>,
  recipeId: string,
): Promise<void> {
  const action = "favourite the recipe";

  const { error } = await client
    .from("recipe_favourites")
    .upsert({ recipe_id: recipeId }, { onConflict: "owner_id,recipe_id", ignoreDuplicates: true });

  if (error) {
    if (error.code === FAVOURITE_LIMIT_CODE) {
      throw new FavouriteRuleError(action, "favourite_limit");
    }
    throw favouriteRepoError(action, error);
  }
}

/** Removes a recipe from the favourites. A recipe that is not a favourite matches no row and is not an error. */
export async function removeFavouriteRecipe(
  client: SupabaseClient<Database>,
  recipeId: string,
): Promise<void> {
  const { error } = await client.from("recipe_favourites").delete().eq("recipe_id", recipeId);

  if (error) {
    throw favouriteRepoError("unfavourite the recipe", error);
  }
}
