import { isValidTimeZone, toLocalDate } from "@keylow/core/dates";
import { toDayOfWeekKcal } from "@keylow/core/engine";

import type { Database } from "../database.types";
import type { ProgressTargets, ValidTargets } from "@keylow/core/diary";
import type { DayOfWeekKcal } from "@keylow/core/engine";
import type { WeightDisplayUnit } from "@keylow/core/weight";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// Targets are health data. The database's own message can quote a value (a refused number is written into
// it), so a failure names the action and the error code only, and the cause holds the code and nothing else.

const TARGET_COLUMNS = "target_kcal,target_protein_g,target_carbs_g,target_fat_g";
const ENGINE_TARGET_COLUMNS = "program_id,calories_kcal,protein_g,fat_g,carbs_g,dow_calories_kcal";

/**
 * The user's calorie and macro targets, as core's `progressBars` takes them. Null is not set. `kcal` is
 * the week's figure. `source` says where they come from: `engine` is the current `targets` row of the
 * active program, which also carries `dowCaloriesKcal` (Monday first, for core's `dayTarget`), and
 * `manual` is what the user typed on the profile, which has no day by day figures.
 */
export type Targets = ProgressTargets &
  ({ source: "engine"; dowCaloriesKcal: DayOfWeekKcal } | { source: "manual" });

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
  source: "manual",
});

/**
 * Reads the signed in user's targets (ADR 0002, Amendment 2, "Engine targets and manual targets"). A user
 * with an active program (`ended_on` is null) and a current `targets` row (`effective_to` is null) that
 * belongs to it (`program_id` is the program's id) reads that row, with `source` `engine`. Anyone else
 * reads the manual targets on the profile, with `source` `manual`: no program, a program the wizard has
 * just made that has no row of its own yet, or an ended program, whose last row stays open and is not in
 * force, whether or not a newer program has started since. The two engine reads run together, and the
 * profile is read only when they do not find a row for the program. Row level security only shows a user their own rows, so no
 * id is needed. A user who never set a target, or who has no profile row, gets every target as null.
 */
export async function getMyTargets(client: SupabaseClient<Database>): Promise<Targets> {
  const [program, current] = await Promise.all([
    client.from("programs").select("id").is("ended_on", null).maybeSingle(),
    client.from("targets").select(ENGINE_TARGET_COLUMNS).is("effective_to", null).maybeSingle(),
  ]);

  if (program.error) {
    throw repoError("load your targets", program.error);
  }
  if (current.error) {
    throw repoError("load your targets", current.error);
  }

  if (program.data !== null && current.data?.program_id === program.data.id) {
    return {
      kcal: current.data.calories_kcal,
      protein_g: current.data.protein_g,
      carbs_g: current.data.carbs_g,
      fat_g: current.data.fat_g,
      dowCaloriesKcal: toDayOfWeekKcal(current.data.dow_calories_kcal),
      source: "engine",
    };
  }

  const { data, error } = await client.from("profiles").select(TARGET_COLUMNS).maybeSingle();

  if (error) {
    throw repoError("load your targets", error);
  }

  return targetsOf(data);
}

/**
 * Ends the active program, if there is one, by setting `ended_on`: writing your own targets turns the
 * weekly check-in off (ADR 0002, Amendment 2, Q5). The update names exactly `ended_on` and `updated_at`,
 * because a client writes `updated_at` on every update (ADR 0003, Amendment 12), and it applies only
 * while the program is still open. A user with no active program has nothing written. The date is the
 * user's local date in the profile's time zone (a zone this build does not know reads as UTC, as the
 * check-in reads it), or the program's `started_on` when that is later, as it is for a user who has
 * moved to an earlier time zone, so the database check `ended_on >= started_on` can never refuse it.
 */
async function endActiveProgram(client: SupabaseClient<Database>, now: Date) {
  const active = await client
    .from("programs")
    .select("id,started_on")
    .is("ended_on", null)
    .maybeSingle();
  if (active.error) {
    throw repoError("save your targets", active.error);
  }
  if (active.data === null) {
    return;
  }

  const timeZone = await getMyTimeZone(client);
  const localToday = toLocalDate(
    now,
    timeZone !== null && isValidTimeZone(timeZone) ? timeZone : "UTC",
  );
  const { error } = await client
    .from("programs")
    .update({
      // Dates in `YYYY-MM-DD` order the same as text.
      ended_on: localToday < active.data.started_on ? active.data.started_on : localToday,
      updated_at: now.toISOString(),
    })
    .eq("id", active.data.id)
    .is("ended_on", null);
  if (error) {
    throw repoError("save your targets", error);
  }
}

/**
 * Saves the targets on the profile of `userId`, writing only the four target columns and the time they
 * were set (the column grant allows no others). They are manual targets, so the active program, if
 * there is one, is ended first, and a failure to end it stops before the profile is written. A blank
 * macro is written as null, which clears it. Row level security lets a user update only their own row,
 * so another user's id updates nothing, and that throws. Returns the targets as saved, with `source`
 * `manual`.
 */
export async function updateMyTargets(
  client: SupabaseClient<Database>,
  userId: string,
  targets: ValidTargets,
): Promise<Targets> {
  const now = new Date();
  await endActiveProgram(client, now);

  const { data, error } = await client
    .from("profiles")
    .update({
      target_kcal: targets.kcal,
      target_protein_g: targets.protein_g,
      target_carbs_g: targets.carbs_g,
      target_fat_g: targets.fat_g,
      targets_updated_at: now.toISOString(),
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

/**
 * Reads the unit the signed in user's profile shows loads in, `kg` or `lb`. The column also allows `st`,
 * which training does not use, so that, a unit this build does not know, no value and no profile row
 * all read as `kg`.
 */
export async function getMyWeightUnit(
  client: SupabaseClient<Database>,
): Promise<WeightDisplayUnit> {
  const { data, error } = await client.from("profiles").select("weight_unit").maybeSingle();

  if (error) {
    throw repoError("load your weight unit", error);
  }

  return data?.weight_unit === "lb" ? "lb" : "kg";
}

/**
 * Saves the IANA time zone on the signed in user's own profile, writing the time zone column and nothing
 * else (the column grant allows it, and row level security limits the update to the user's own row, so
 * it never reaches another user's). The caller checks the zone first, with core's `isValidTimeZone`. A
 * failure names the action and the error code only, so the zone is never in a message.
 */
export async function updateMyTimeZone(client: SupabaseClient<Database>, timeZone: string) {
  const { data, error: userError } = await client.auth.getUser();
  if (userError) {
    throw new Error("Could not save your time zone: you are not signed in", { cause: userError });
  }

  const { error } = await client
    .from("profiles")
    .update({ timezone: timeZone })
    .eq("id", data.user.id);

  if (error) {
    throw repoError("save your time zone", error);
  }
}
