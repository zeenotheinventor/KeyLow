import { buildManualWeighIn } from "@keylow/core/weight";

import { recomputeMyTargets } from "./program";
import { addWeighIn } from "./weighIns";
import { toEdgeErrorKind } from "../errors";

import type { Database } from "../database.types";
import type { EdgeErrorKind } from "../errors";
import type { StartingPlan } from "@keylow/core/setup";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// The setup state is health data: the stats, the program and the weight never reach a message. A failure
// names the action and the error code only, and the cause holds the code and nothing else, because the
// database's own message can quote a value.

const PROFILE_COLUMNS = "sex,birth_date,height_cm,activity,weight_unit,onboarding_completed_at";
const PROGRAM_COLUMNS =
  "id,goal,rate_pct_per_week,protein_g_per_kg,fat_fraction_of_remaining,split_preset";
const WEIGH_IN_COLUMNS = "weight_kg,local_date";

type ProfileTable = Database["public"]["Tables"]["profiles"]["Row"];
type ProgramTable = Database["public"]["Tables"]["programs"]["Row"];

/**
 * The profile fields the wizard starts from, each null when unset. `weightUnit` is the stored value as
 * it is, `st` included: the wizard never overwrites a stored unit, and enters weight in lb when `st` is
 * stored. It is not narrowed to the units this build shows.
 */
export type SetupStats = {
  sex: ProfileTable["sex"];
  birthDate: ProfileTable["birth_date"];
  heightCm: ProfileTable["height_cm"];
  activity: ProfileTable["activity"];
  weightUnit: ProfileTable["weight_unit"];
};

/**
 * The active program. `ratePctPerWeek` is a magnitude, the direction is in `goal`. `splitPreset` is the
 * stored key (`balanced`, `low_fat` or `low_carb`), the key of the engine's params, with no mapping.
 */
export type SetupProgram = {
  id: ProgramTable["id"];
  goal: ProgramTable["goal"];
  ratePctPerWeek: ProgramTable["rate_pct_per_week"];
  proteinGPerKg: ProgramTable["protein_g_per_kg"];
  fatFraction: ProgramTable["fat_fraction_of_remaining"];
  splitPreset: ProgramTable["split_preset"];
};

export type SetupWeighIn = { weightKg: number; localDate: string };

export type SetupState = {
  /** False only for a profile whose `onboarding_completed_at` is null. No profile row reads as set up. */
  isSetUp: boolean;
  stats: SetupStats;
  /** The program with `ended_on` null, or null when there is none. */
  program: SetupProgram | null;
  /** The newest live weigh-in on any date, or null when there is none. */
  latestWeighIn: SetupWeighIn | null;
};

const repoError = (action: string, cause: PostgrestError) =>
  new Error(`Could not ${action} (${cause.code})`, { cause: { code: cause.code } });

/**
 * Reads what the setup wizard starts from and what decides whether it shows: whether the signed in user
 * is set up, the stats on the profile, the active program and the latest live weigh-in. Row level
 * security shows a user only their own rows, so no id is needed. A signed in user with no profile row
 * reads as set up, with every stat null, so the first run gate never traps an account it cannot read.
 * The program read is a plain select of the active row: one program is active per user (a partial
 * unique index), and nothing here writes.
 */
export async function getMySetupState(client: SupabaseClient<Database>): Promise<SetupState> {
  const [profile, program, weighIn] = await Promise.all([
    client.from("profiles").select(PROFILE_COLUMNS).maybeSingle(),
    client.from("programs").select(PROGRAM_COLUMNS).is("ended_on", null).maybeSingle(),
    client
      .from("weigh_ins")
      .select(WEIGH_IN_COLUMNS)
      .is("deleted_at", null)
      .order("local_date", { ascending: false })
      .order("measured_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profile.error) {
    throw repoError("load your setup", profile.error);
  }
  if (program.error) {
    throw repoError("load your setup", program.error);
  }
  if (weighIn.error) {
    throw repoError("load your setup", weighIn.error);
  }

  return {
    isSetUp: profile.data === null || profile.data.onboarding_completed_at !== null,
    stats: {
      sex: profile.data?.sex ?? null,
      birthDate: profile.data?.birth_date ?? null,
      heightCm: profile.data?.height_cm ?? null,
      activity: profile.data?.activity ?? null,
      weightUnit: profile.data?.weight_unit ?? null,
    },
    program:
      program.data === null
        ? null
        : {
            id: program.data.id,
            goal: program.data.goal,
            ratePctPerWeek: program.data.rate_pct_per_week,
            proteinGPerKg: program.data.protein_g_per_kg,
            fatFraction: program.data.fat_fraction_of_remaining,
            splitPreset: program.data.split_preset,
          },
    latestWeighIn:
      weighIn.data === null
        ? null
        : { weightKg: weighIn.data.weight_kg, localDate: weighIn.data.local_date },
  };
}

/** What `startingPlan` in core hands the api-client to save: the profile, the program and the weigh-in. */
export type SetupSave = StartingPlan["save"];

export type SaveSetupOptions = {
  /** The weight of the user's latest weigh-in on any date, or null when there is none (`useSetupState`). */
  latestWeighInKg: number | null;
  /** The IANA zone of the profile, which dates the weigh-in. */
  timeZone: string;
};

type SaveStep = "weigh-in" | "program" | "profile";

/** A weight entered within this many kilograms of the latest weigh-in is the same weight (ADR 0003, Amendment 12). */
const SAME_WEIGHT_TOLERANCE_KG = 0.05;
/** Subtracting two weights is not exact in floating point, so a difference of exactly the tolerance still counts. */
const FLOATING_POINT_SLACK_KG = 1e-9;

const saveError = (step: SaveStep, code: string) =>
  new Error(`Could not save your setup (${step}, ${code})`, { cause: { step, code } });

const codeOf = (error: unknown): string | undefined =>
  error instanceof Error &&
  typeof error.cause === "object" &&
  error.cause !== null &&
  "code" in error.cause &&
  typeof error.cause.code === "string"
    ? error.cause.code
    : undefined;

const isSameWeight = (weightKg: number, latestWeighInKg: number | null) =>
  latestWeighInKg !== null &&
  Math.abs(weightKg - latestWeighInKg) <= SAME_WEIGHT_TOLERANCE_KG + FLOATING_POINT_SLACK_KG;

async function saveWeighIn(
  client: SupabaseClient<Database>,
  save: SetupSave,
  options: SaveSetupOptions,
  now: Date,
) {
  // The skip rule is the repo's, not the screen's: a prefilled weight shown in lb to one decimal and
  // saved unchanged is within the tolerance, and no date is looked at, so a recalculation never writes
  // a stale value dated today.
  if (isSameWeight(save.weighIn.weightKg, options.latestWeighInKg)) {
    return;
  }

  const weighIn = buildManualWeighIn({
    weightKg: save.weighIn.weightKg,
    measuredAt: now,
    note: null,
    timeZone: options.timeZone,
  });

  try {
    await addWeighIn(client, weighIn);
  } catch (error) {
    const code = codeOf(error);
    // An error with no code is a row that would not parse. Its message holds a row id and field paths only.
    throw code === undefined ? error : saveError("weigh-in", code);
  }
}

async function saveProgram(client: SupabaseClient<Database>, save: SetupSave, now: Date) {
  const { program } = save;
  // Named one by one and not spread: `dow_offsets_kcal`, `goal_weight_kg`, `next_checkin_date` and
  // `ended_on` are never the wizard's to write, and `started_on` is for the insert only.
  const recalculated = {
    goal: program.goal,
    rate_pct_per_week: program.rate_pct_per_week,
    protein_g_per_kg: program.protein_g_per_kg,
    fat_fraction_of_remaining: program.fat_fraction_of_remaining,
    split_preset: program.split_preset,
    updated_at: now.toISOString(),
  };

  // Read, then insert or update: the one-active index is partial, so there is nothing to upsert against.
  const active = await client.from("programs").select("id").is("ended_on", null).maybeSingle();
  if (active.error) {
    throw saveError("program", active.error.code);
  }

  if (active.data === null) {
    // Two presses, or a second device, can race to here. The index refuses the second insert (23505),
    // and the user's retry then finds the active row and updates it.
    const { error } = await client
      .from("programs")
      .insert({ ...recalculated, started_on: program.started_on });
    if (error) {
      throw saveError("program", error.code);
    }
    return;
  }

  const { error } = await client
    .from("programs")
    .update(recalculated)
    .eq("id", active.data.id)
    .select("id")
    .single();
  if (error) {
    throw saveError("program", error.code);
  }
}

async function saveProfile(
  client: SupabaseClient<Database>,
  userId: string,
  save: SetupSave,
  now: Date,
) {
  const { profile } = save;
  const savedAt = now.toISOString();

  // Named one by one and not spread, so nothing but these columns can reach the row (no id, no terms
  // columns). `weight_unit` is there only when the stored unit was null: a stored unit is never overwritten.
  const { error } = await client
    .from("profiles")
    .update({
      sex: profile.sex,
      birth_date: profile.birth_date,
      height_cm: profile.height_cm,
      activity: profile.activity,
      onboarding_weight_kg: profile.onboarding_weight_kg,
      target_kcal: profile.target_kcal,
      target_protein_g: profile.target_protein_g,
      target_carbs_g: profile.target_carbs_g,
      target_fat_g: profile.target_fat_g,
      targets_updated_at: savedAt,
      onboarding_completed_at: savedAt,
      ...(profile.weight_unit === undefined ? {} : { weight_unit: profile.weight_unit }),
    })
    .eq("id", userId)
    .select("id")
    .single();
  if (error) {
    throw saveError("profile", error.code);
  }
}

/**
 * What a save resolves with. `targetsPending` is true when the account is saved but the engine's first
 * targets are not made yet: `recomputeCode` is then the code the recompute failed with (`failed` when the
 * failure was not a typed answer), and nothing else about it.
 */
export type SaveSetupResult =
  { targetsPending: false } | { targetsPending: true; recomputeCode: EdgeErrorKind };

// A recompute failure does not undo the save, and is reported as a code and never thrown. By then the
// weigh-in, the program and the profile are written, and the profile holds the manual targets the wizard
// worked out, so the account is set up and the diary shows those targets until the app's next due run, or
// a retry, makes the engine's. Throwing would tell a user whose account is set up that the save failed.
async function recomputeTargets(client: SupabaseClient<Database>): Promise<SaveSetupResult> {
  try {
    await recomputeMyTargets(client);
    return { targetsPending: false };
  } catch (failure) {
    return {
      targetsPending: true,
      recomputeCode: failure instanceof Error ? toEdgeErrorKind(failure) : "failed",
    };
  }
}

/**
 * Saves the setup wizard's result for `userId` (`startingPlan(...).save` in core), in three steps and in
 * this order (ADR 0003, Amendment 12, "How the wizard saves"): the weigh-in, the program, and the
 * profile last. The profile carries `onboarding_completed_at`, so a failure at any step leaves the
 * account not set up and the user can press the button again. A failure stops the later steps and
 * throws `Could not save your setup (step, code)`, with the step `weigh-in`, `program` or `profile`,
 * and no value, because every value here is health data.
 *
 * A fourth step then asks `run-checkin` to recompute (ADR 0002, Amendment 2), which makes the start
 * snapshot, the schedule and the first engine targets. It is not part of the save: the save is done
 * once the profile is written. The result says whether the targets are pending (see `SaveSetupResult`).
 *
 * A retry after a failure in the program or the profile step can add a second manual weigh-in for
 * today. That is accepted: the weight trend uses the median of a day's weigh-ins.
 */
export async function saveMySetup(
  client: SupabaseClient<Database>,
  userId: string,
  save: SetupSave,
  options: SaveSetupOptions,
): Promise<SaveSetupResult> {
  const now = new Date();

  await saveWeighIn(client, save, options, now);
  await saveProgram(client, save, now);
  await saveProfile(client, userId, save, now);

  return recomputeTargets(client);
}

/**
 * Marks the signed in user's account set up without a plan, for the first run's "I'll set my own
 * targets". The update carries `onboarding_completed_at` (now, on the client's clock) and no other
 * column, so no stat, target or program can change. A failure throws `Could not mark your setup done
 * (code)` and nothing else, because the database's own message can quote a value.
 */
export async function markMySetupDone(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id")
    .single();
  if (error) {
    throw repoError("mark your setup done", error);
  }
}
