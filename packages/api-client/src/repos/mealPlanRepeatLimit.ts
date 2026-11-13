import { repoError } from "./repoError";

import type { Database } from "../database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The largest limit the database accepts (`profiles.meal_plan_repeat_limit`, ADR 0003, Amendment 22). */
export const MEAL_PLAN_REPEAT_LIMIT_MAX = 7;

/**
 * The most times one recipe may appear in a week's plan, as the signed in user chose it. Null means they
 * have not chosen, and core applies its default then. 0 means no limit, and 1 to 7 is the limit. Row
 * level security shows a user their own profile only, so no id is needed, and a user with no profile row
 * reads as not chosen.
 */
export async function getMealPlanRepeatLimit(
  client: SupabaseClient<Database>,
): Promise<number | null> {
  const { data, error } = await client
    .from("profiles")
    .select("meal_plan_repeat_limit")
    .maybeSingle();

  if (error) {
    throw repoError("load your repeat limit", error);
  }

  return data?.meal_plan_repeat_limit ?? null;
}

/**
 * Writes the person's choice, or null to go back to not chosen. Only that column is written (the column
 * grant allows it), and row level security limits the update to the user's own row. A value outside 0 to
 * 7, or one that is not a whole number, is refused before any request. An update that reaches no row
 * (someone else's id, or no profile) changes nothing, so it throws rather than reporting a success.
 */
export async function setMealPlanRepeatLimit(
  client: SupabaseClient<Database>,
  userId: string,
  limit: number | null,
): Promise<void> {
  const action = "save your repeat limit";
  if (
    limit !== null &&
    !(Number.isInteger(limit) && limit >= 0 && limit <= MEAL_PLAN_REPEAT_LIMIT_MAX)
  ) {
    throw repoError(action, { code: "invalid" });
  }

  const { data, error } = await client
    .from("profiles")
    .update({ meal_plan_repeat_limit: limit })
    .eq("id", userId)
    .select("id");

  if (error) {
    throw repoError(action, error);
  }
  if (data.length === 0) {
    throw new Error(`Could not ${action}: no profile was changed`);
  }
}
