import { foodRowSchema } from "@keylow/core/schemas";
import { z } from "zod";

import { FavouriteRuleError } from "../errors";
import { FOOD_COLUMNS } from "./foods";

import type { Database } from "../database.types";
import type { Food } from "@keylow/core/schemas";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// What a person favourites is health data. A failure here names the action and the error code only,
// and the cause holds the code and nothing else. A row that does not parse is reported by its action
// alone, because the issues of a parse can quote the value that failed.

/** The error code the database raises when a person already holds 30 favourites. */
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
 * error. A person holds at most 30: the database refuses the 31st, and this throws a
 * `FavouriteRuleError` with the rule `favourite_limit`. A food the caller cannot see, or that is
 * deleted, is refused by the table's policy, and that fails with its code (42501).
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
