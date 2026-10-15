import type { Database } from "../database.types";
import type { ProgressTargets, ValidTargets } from "@keylow/core/diary";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// Targets are health data. The database's own message can quote a value (a refused number is written into
// it), so a failure names the action and the error code only, and the cause holds the code and nothing else.

const TARGET_COLUMNS = "target_kcal,target_protein_g,target_carbs_g,target_fat_g";

/** The manual calorie and macro targets on the profile, as core's `progressBars` takes them. Null is not set. */
export type Targets = ProgressTargets;

const repoError = (action: string, cause: PostgrestError) =>
  new Error(`Could not ${action} (${cause.code})`, { cause: { code: cause.code } });

type TargetColumns = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "target_kcal" | "target_protein_g" | "target_carbs_g" | "target_fat_g"
>;

const targetsOf = (row: TargetColumns | null): Targets => ({
  kcal: row?.target_kcal ?? null,
  protein_g: row?.target_protein_g ?? null,
  carbs_g: row?.target_carbs_g ?? null,
  fat_g: row?.target_fat_g ?? null,
});

/**
 * Reads the signed in user's manual targets. Row level security only shows a user their own profile, so
 * no id is needed. A user who never set a target, or who has no profile row, gets every target as null.
 */
export async function getMyTargets(client: SupabaseClient<Database>): Promise<Targets> {
  const { data, error } = await client.from("profiles").select(TARGET_COLUMNS).maybeSingle();

  if (error) {
    throw repoError("load your targets", error);
  }

  return targetsOf(data);
}

/**
 * Saves the targets on the profile of `userId`, writing only the four target columns and the time they
 * were set (the column grant allows no others). A blank macro is written as null, which clears it. Row
 * level security lets a user update only their own row, so another user's id updates nothing, and that
 * throws. Returns the targets as saved.
 */
export async function updateMyTargets(
  client: SupabaseClient<Database>,
  userId: string,
  targets: ValidTargets,
): Promise<Targets> {
  const { data, error } = await client
    .from("profiles")
    .update({
      target_kcal: targets.kcal,
      target_protein_g: targets.protein_g,
      target_carbs_g: targets.carbs_g,
      target_fat_g: targets.fat_g,
      targets_updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select(TARGET_COLUMNS)
    .single();

  if (error) {
    throw repoError("save your targets", error);
  }

  return targetsOf(data);
}

/**
 * Reads the IANA time zone of the signed in user's profile, the zone the diary reads its days and hours
 * in. Resolves to null for a signed in user who has no profile row.
 */
export async function getMyTimeZone(client: SupabaseClient<Database>): Promise<string | null> {
  const { data, error } = await client.from("profiles").select("timezone").maybeSingle();

  if (error) {
    throw repoError("load your time zone", error);
  }

  return data?.timezone ?? null;
}
