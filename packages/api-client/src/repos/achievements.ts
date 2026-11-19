import { mapAchievementStats } from "./achievementStatsMapping";
import { repoError } from "./repoError";

import type { AchievementSnapshot } from "./achievementStatsMapping";
import type { Database } from "../database.types";
import type { FreezeRow } from "@keylow/core";
import type { SupabaseClient } from "@supabase/supabase-js";

// Achievements and the freeze ledger say what a person eats, weighs and trains, so they are health data.
// Every failure names the action and a code only. The database's message, details and hint are never
// kept, and nothing read or written is put in an error.

/**
 * The streaks are walked from the first day, so the stats are read from a date no history can precede.
 * `achievement_stats` takes a date that is not null, and this one is a fixed one rather than the profile's
 * creation date because it needs no second read, and an entry may be dated before the profile was made.
 */
const EARLIEST_HISTORY = "2000-01-01";

/**
 * Reads the signed in user's stats snapshot (`achievement_stats`) and maps it to what the engine reads.
 * The mapping and its checks are in `mapAchievementStats`.
 */
export async function fetchAchievementStats(
  client: SupabaseClient<Database>,
): Promise<AchievementSnapshot> {
  const { data, error } = await client.rpc("achievement_stats", { p_from: EARLIEST_HISTORY });

  if (error) {
    throw repoError("read the achievement stats", error);
  }

  return mapAchievementStats(data);
}

/**
 * Records the achievements earned and resolves to the ids that were new to the database, which is what
 * one device is told to celebrate. An ordinary run with nothing earned sends nothing. A backfill is
 * always sent, even with no ids, because it is what marks the backfill done.
 */
export async function recordAchievements(
  client: SupabaseClient<Database>,
  ids: readonly string[],
  backfill: boolean,
): Promise<string[]> {
  if (ids.length === 0 && !backfill) {
    return [];
  }

  const { data, error } = await client.rpc("record_achievements", {
    p_ids: [...ids],
    p_backfill: backfill,
  });

  if (error) {
    throw repoError("record the achievements", error);
  }

  return data;
}

/**
 * Appends freeze ledger rows. A row the ledger already holds, by kind, reason and reference, is left as
 * it is, so writing the same rows twice is harmless.
 */
export async function appendFreezeEvents(
  client: SupabaseClient<Database>,
  rows: readonly FreezeRow[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const { error } = await client.from("streak_freeze_events").upsert(
    rows.map((row) => ({
      kind: row.kind,
      reason: row.reason,
      ref: row.reference,
      count: row.count,
      local_date: row.date,
    })),
    { onConflict: "user_id,kind,reason,ref", ignoreDuplicates: true },
  );

  if (error) {
    throw repoError("save the streak freezes", error);
  }
}

/** Stamps `seenAt` on the given achievements the person has not seen yet. Ones already seen keep their stamp. */
export async function markAchievementsSeen(
  client: SupabaseClient<Database>,
  ids: readonly string[],
  seenAt: Date = new Date(),
): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const { error } = await client
    .from("user_achievements")
    .update({ seen_at: seenAt.toISOString() })
    .in("achievement_id", [...ids])
    .is("seen_at", null);

  if (error) {
    throw repoError("mark the achievements seen", error);
  }
}
