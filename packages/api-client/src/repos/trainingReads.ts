import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { TRAINING_PARAMS_V2, currentMuscleState } from "@keylow/core/training";

import { getActiveRoutine, listSetsFrom } from "./training";
import { getCurrentTrainingGoals } from "./trainingGoals";

import type { ActiveRoutine, TrainingSet } from "./trainingSchemas";
import type { Database } from "../database.types";
import type { TrainingGoalsRow } from "@keylow/core/schemas";
import type { MuscleId, MuscleState } from "@keylow/core/training";
import type { SupabaseClient } from "@supabase/supabase-js";

// The heat window reaches 14 days back from a moment, so it starts at some hour of the local day 14 days
// back. Reading from the start of the day before that covers it whatever the hour.
export const HEAT_LOOKBACK_DAYS = TRAINING_PARAMS_V2.heatWindowDays + 1;

/** The rows the next-session suggestion is worked out from: the sets of the heat window, the routine and the goal. */
export type TrainingInputs = {
  sets: TrainingSet[];
  activeRoutine: ActiveRoutine | null;
  goal: TrainingGoalsRow | null;
};

/**
 * Reads what core's `nextSessionSuggestion` needs of the signed in user, apart from the exercise library:
 * the live sets from the day 15 days before `today` through `today` (`YYYY-MM-DD` in the user's zone), the
 * active routine and the current goal, or null for either the user does not have. It holds no hook and no
 * cache, so an Edge Function reads the rows the same way the app does. Row level security shows a user
 * their own rows only. A failed read throws what the read throws, which names the action and the error
 * code only.
 */
export async function readTrainingInputs(
  client: SupabaseClient<Database>,
  { today }: { today: string },
): Promise<TrainingInputs> {
  const [sets, activeRoutine, goal] = await Promise.all([
    listSetsFrom(client, addCalendarDays(today, -HEAT_LOOKBACK_DAYS), today),
    getActiveRoutine(client),
    getCurrentTrainingGoals(client),
  ]);
  return { sets, activeRoutine, goal };
}

/**
 * Each muscle's heat, ready time, weekly sets and volume status at `now`, an ISO timestamp with a zone,
 * from the signed in user's sets of the heat window, the days read in `timeZone`. Only the sets are read:
 * the plan does not change a volume status (ADR 0005, Amendment 6).
 */
export async function readMuscleState(
  client: SupabaseClient<Database>,
  { now, timeZone }: { now: string; timeZone: string },
): Promise<Record<MuscleId, MuscleState>> {
  const today = toLocalDate(new Date(now), timeZone);
  const sets = await listSetsFrom(client, addCalendarDays(today, -HEAT_LOOKBACK_DAYS), today);
  return currentMuscleState(sets, now);
}
