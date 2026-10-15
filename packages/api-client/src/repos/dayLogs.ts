import { z } from "zod";

import { repoError } from "./diaryRows";

import type { Database } from "../database.types";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

const LOCAL_DATE = z.iso.date();
const UNIQUE_VIOLATION = "23505";

const markError = (cause: PostgrestError) => repoError("mark the day", cause);

/**
 * Marks a day complete or not (`complete`), recording when it was completed in `completed_at`
 * (cleared when the day is marked incomplete). The note of the day is left as it is.
 *
 * This is an upsert in effect, written as an update and then an insert. A real upsert sends the
 * key columns (`user_id`, `local_date`) in its `DO UPDATE SET` too, and clients are granted update
 * on `is_complete`, `completed_at` and `note` only, so the database refuses it. An incomplete day
 * that has no day log is already what was asked for, so nothing is written. When another call adds
 * the day log between the update and the insert, the insert fails on the key and the update runs
 * again.
 *
 * Throws a `RangeError` before any request when `localDate` is not a `YYYY-MM-DD` date.
 */
export async function setDayComplete(
  client: SupabaseClient<Database>,
  localDate: string,
  complete: boolean,
): Promise<void> {
  if (!LOCAL_DATE.safeParse(localDate).success) {
    throw new RangeError("A diary day must be a calendar date written YYYY-MM-DD");
  }

  const completion = {
    is_complete: complete,
    completed_at: complete ? new Date().toISOString() : null,
  };

  if (await updateDayLog(client, localDate, completion)) {
    return;
  }
  if (!complete) {
    return;
  }

  const { error } = await client.from("day_logs").insert({ local_date: localDate, ...completion });
  if (error?.code === UNIQUE_VIOLATION) {
    await updateDayLog(client, localDate, completion);
    return;
  }
  if (error) {
    throw markError(error);
  }
}

/** Resolves to whether the day had a day log to update. */
async function updateDayLog(
  client: SupabaseClient<Database>,
  localDate: string,
  completion: { is_complete: boolean; completed_at: string | null },
): Promise<boolean> {
  const { data, error } = await client
    .from("day_logs")
    .update(completion)
    .eq("local_date", localDate)
    .select("local_date");

  if (error) {
    throw markError(error);
  }
  return data.length > 0;
}
