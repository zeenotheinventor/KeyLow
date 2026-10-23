import type { Database } from "../database.types";
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
