import type { Database } from "../database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The actions that are counted for the achievements and that the database does not otherwise record. A
 * barcode and an exercise demo carry a ref and count once for each ref. The rest carry none and count every
 * time. The list is the one in the `achievement_events` check.
 */
export type AchievementEventKind =
  | "barcode_scanned"
  | "exercise_demo_opened"
  | "week_view_opened"
  | "data_exported"
  | "log_from_favourites"
  | "shopping_item_ticked"
  | "recipe_draft_saved";

/**
 * Records that the signed in user did something countable. Fire and forget: it never throws and never
 * reports a failure, so the action it follows is never blocked, slowed or broken by it, and nothing about a
 * failure is kept because a row can say what a person scanned or ate. The row is inserted with duplicates
 * ignored, so a barcode or an exercise already held counts once. `ref` is a barcode or an exercise id and
 * is left out for every other kind. It is never a health value.
 */
export async function recordAchievementEvent(
  client: SupabaseClient<Database>,
  kind: AchievementEventKind,
  ref?: string,
): Promise<void> {
  try {
    await client
      .from("achievement_events")
      .upsert(
        { kind, ref: ref ?? null },
        { onConflict: "user_id,kind,ref", ignoreDuplicates: true },
      );
  } catch {
    // The count is missed this once. The action it belongs to has already happened.
  }
}
