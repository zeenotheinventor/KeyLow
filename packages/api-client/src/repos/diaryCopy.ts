import { formatClockTime, instantAtLocalTime, toLocalDate } from "@keylow/core/dates";
import { z } from "zod";

import { getDiaryDay } from "./diary";
import { repoError } from "./diaryRows";
import { diaryInsertSchema } from "./diarySchemas";

import type { DiaryInsert, LogEntry } from "./diarySchemas";
import type { Database } from "../database.types";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// These are health data. Nothing here puts a food, an amount or a nutrient value in an error: a
// failed write names the action and a row id, never what the row held.

const LOCAL_DATE = z.iso.date();

/** What a day copy needs: the two days (`YYYY-MM-DD`) and the profile's IANA time zone that decides each entry's clock time. */
export type CopyDayInput = {
  from: string;
  to: string;
  timeZone: string;
};

/** What a day copy did. `count` is for the toast, and `entryIds` are the rows it inserted, which the Undo takes back. */
export type CopiedDay = {
  /** The day the entries were copied onto. */
  localDate: string;
  count: number;
  entryIds: string[];
};

const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * Thrown when a copy failed part way and the copies already written could not be taken back either.
 * The day now holds `entryIds`, copies of a day the user did not finish copying. Refresh the day
 * and offer to remove them with `undoCopyDay`, which takes the same ids.
 */
export class CopyDayPartialWriteError extends Error {
  readonly entryIds: string[];

  constructor(entryIds: string[], message: string, cause: unknown) {
    super(message, { cause });
    this.name = "CopyDayPartialWriteError";
    this.entryIds = entryIds;
  }
}

function assertLocalDate(localDate: string): void {
  if (!LOCAL_DATE.safeParse(localDate).success) {
    throw new RangeError("A diary day must be a calendar date written YYYY-MM-DD");
  }
}

/**
 * Moves an entry to another day, keeping its clock time as the profile's zone reads it, with the
 * seconds of the original, so the copy is the same clock instant on the target day. A time the
 * clocks skip on the target day moves forward, as `instantAtLocalTime` in core says. Parsing
 * with the insert schema of core also drops the columns a client may not insert (the id, the
 * creation time and the generated `kcal`), since the database fills those in.
 */
function copyOnto(entry: LogEntry, to: string, timeZone: string): DiaryInsert {
  const [hour = 0, minute = 0] = formatClockTime(new Date(entry.logged_at), timeZone)
    .split(":")
    .map(Number);
  const sourceInstant = Date.parse(entry.logged_at);
  const secondsOfSource =
    sourceInstant - Math.floor(sourceInstant / MILLISECONDS_PER_MINUTE) * MILLISECONDS_PER_MINUTE;
  const loggedAt = new Date(
    instantAtLocalTime(to, hour, minute, timeZone).getTime() + secondsOfSource,
  );

  const result = diaryInsertSchema.safeParse({
    ...entry,
    local_date: toLocalDate(loggedAt, timeZone),
    logged_at: loggedAt.toISOString(),
  });
  if (!result.success) {
    const paths = result.error.issues.map((issue) => issue.path.join(".") || "(row)");
    throw new Error(
      `Could not copy the day: entry ${entry.id} has an unexpected shape at ${paths.join(", ")}`,
    );
  }
  return result.data;
}

async function insertCopy(
  client: SupabaseClient<Database>,
  copy: DiaryInsert,
): Promise<{ id: string } | { error: PostgrestError }> {
  const table = client.from("food_log_entries");
  // Narrow the union so each branch type-checks against the generated insert type.
  const { data, error } = await (
    copy.item_type === "food" ? table.insert(copy) : table.insert(copy)
  )
    .select("id")
    .single();

  return error === null ? data : { error };
}

/**
 * Copies the live entries of the day `from` onto the day `to`, with their snapshots and nutrients
 * unchanged. Each copy keeps the clock time of its original (08:05 stays 08:05), read and set in
 * the profile's time zone, so a copy across a clock change lands at the same time on the wall
 * clock. A time the clocks skip on the target day (01:30 on the day they go forward in London)
 * moves forward, so it becomes 02:30. The seconds of the original are kept, so a copy is the same
 * clock instant on the target day, and `local_date` is recomputed from the new instant.
 *
 * Copies are added after what the day holds, never over it. The timeline orders by instant, then
 * by `created_at`, so the copies are inserted one at a time (sequential round trips) in the order
 * of the source day: each gets a later `created_at` than the one before and than any entry already
 * on the day, so a copy at the very same instant as an existing entry sorts after it, and copies
 * that share an instant keep their order. When an insert fails, the copies made so far are taken
 * back and the call throws, so a copy is all of the day or none of it. If they cannot be taken
 * back either, it throws a `CopyDayPartialWriteError` that carries their ids.
 *
 * A day with nothing logged writes nothing and resolves to a count of 0. Throws a `RangeError`
 * before any request when `from` or `to` is not a `YYYY-MM-DD` date, or when they are the same day.
 */
export async function copyDay(
  client: SupabaseClient<Database>,
  { from, to, timeZone }: CopyDayInput,
): Promise<CopiedDay> {
  assertLocalDate(from);
  assertLocalDate(to);
  if (from === to) {
    throw new RangeError("A day cannot be copied onto itself");
  }

  const { entries } = await getDiaryDay(client, from);
  const copies = entries.map((entry) => copyOnto(entry, to, timeZone));

  const entryIds: string[] = [];
  for (const copy of copies) {
    const inserted = await insertCopy(client, copy);
    if ("error" in inserted) {
      // The database's error is not attached as the cause: its details can quote the failing row.
      const failure = new Error(`Could not copy the day: ${inserted.error.message}`);
      const takenBack = await softDeleteEntries(client, entryIds).then(
        () => true,
        () => false,
      );
      throw takenBack
        ? failure
        : new CopyDayPartialWriteError(
            [...entryIds],
            `${failure.message} (${entryIds.length} entries already copied could not be removed)`,
            failure,
          );
    }
    entryIds.push(inserted.id);
  }

  return { localDate: to, count: entryIds.length, entryIds };
}

async function softDeleteEntries(
  client: SupabaseClient<Database>,
  entryIds: readonly string[],
): Promise<void> {
  if (entryIds.length === 0) {
    return;
  }

  const { error } = await client
    .from("food_log_entries")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", [...entryIds])
    .is("deleted_at", null);

  if (error) {
    throw repoError("undo the copy", error);
  }
}

/**
 * Takes back a day copy (its Undo toast): soft deletes exactly the rows the copy inserted, by id,
 * so anything else on the day, including what the user added after the copy, stays. A row deleted
 * since is left as it is. Sends nothing when nothing was copied.
 */
export function undoCopyDay(client: SupabaseClient<Database>, copied: CopiedDay): Promise<void> {
  return softDeleteEntries(client, copied.entryIds);
}
