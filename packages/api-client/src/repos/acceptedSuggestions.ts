import { acceptedSuggestionSchema } from "@keylow/core/schemas";
import {
  SUGGEST_PARAMS_V2,
  parseAcceptedSuggestion,
  toAcceptedExercises,
} from "@keylow/core/training";
import { z } from "zod";

import { idOfRow } from "./diaryRows";
import { trainingRepoError, trainingWeekBounds } from "./training";

import type { Database } from "../database.types";
import type { StoredAcceptedSuggestion } from "@keylow/core/schemas";
import type { Suggestion, SuggestExercise } from "@keylow/core/training";
import type { SupabaseClient } from "@supabase/supabase-js";

// An accepted suggestion shows how a person trains, so it is health data. A failure here names the action
// and the database code only, a row that cannot be read is named by its id and the field paths, and a
// check that fails before a request names the rule and never a value. Accepting and undoing need a
// connection: nothing is queued or replayed from storage.

/** The columns of `accepted_suggestions` a read returns: the ones the projection and the explanation read, and the id. */
const ACCEPTED_COLUMNS = "id,local_date,routine_day_id,exercises,reasons,params_version";

const ROW_ID = z.guid();

/** The code of the unique index that allows one live accepted suggestion per user and day. */
const DAY_TAKEN = "23505";

/** A live accepted suggestion as stored: the id, and the columns core's `acceptedSuggestionSchema` reads. */
export type AcceptedSuggestionRow = StoredAcceptedSuggestion & { id: string };

/** A row that did not parse: its id (null when it has none) and the paths of the fields that broke a rule. Never a value. */
export type SkippedAcceptedSuggestion = { id: string | null; fieldPaths: string[] };

/** What the read gives: the rows that parsed, and a report of the ones that did not. */
export type AcceptedSuggestionsRead = {
  suggestions: AcceptedSuggestionRow[];
  skipped: SkippedAcceptedSuggestion[];
};

/**
 * The signed in user's live accepted suggestions with a `local_date` in the training week that starts on
 * the Monday `weekStart`, in date order, parsed by core (`parseAcceptedSuggestion`). Row level security
 * shows a user their own rows only, and the soft deleted ones are left out. A row that does not parse is
 * skipped, so one bad row never hides the others, and is reported in `skipped` by its id and the paths of
 * its fields. A week that is not a Monday throws a `RangeError` before any request.
 */
export async function listAcceptedSuggestions(
  client: SupabaseClient<Database>,
  weekStart: string,
): Promise<AcceptedSuggestionsRead> {
  const { first, last } = trainingWeekBounds(weekStart);

  const { data, error } = await client
    .from("accepted_suggestions")
    .select(ACCEPTED_COLUMNS)
    .is("deleted_at", null)
    .gte("local_date", first)
    .lte("local_date", last)
    .order("local_date", { ascending: true });

  if (error) {
    throw trainingRepoError("load your accepted suggestions", error);
  }

  return readRows(data);
}

function readRows(rows: readonly unknown[]): AcceptedSuggestionsRead {
  const read: AcceptedSuggestionsRead = { suggestions: [], skipped: [] };
  for (const row of rows) {
    const parsed = parseAcceptedSuggestion(row);
    if (parsed.ok) {
      read.suggestions.push({ id: idOfRow(row), ...parsed.suggestion });
    } else {
      read.skipped.push({ id: parsed.id, fieldPaths: parsed.fieldPaths });
    }
  }
  return read;
}

export type AcceptSuggestion = {
  /** The suggestion on screen. Only the exercises it added are stored: the planned ones are the plan's. */
  suggestion: Suggestion;
  /** The exercise library the suggestion was made from, for the muscle map frozen with each added exercise. */
  library: readonly SuggestExercise[];
  /** The day it is accepted into, `YYYY-MM-DD` in the user's zone. */
  localDate: string;
  /** The routine day it is folded into, or null when it stands alone. */
  routineDayId: string | null;
};

/** The row to insert, or a `RangeError` stating the rule that the suggestion breaks, before any request. */
function insertOf({ suggestion, library, localDate, routineDayId }: AcceptSuggestion) {
  if (suggestion.kind === "nothing") {
    throw new RangeError("A suggestion with nothing to add cannot be accepted");
  }
  const result = acceptedSuggestionSchema.safeParse({
    local_date: localDate,
    routine_day_id: routineDayId,
    exercises: toAcceptedExercises(suggestion, library),
    reasons: {
      picks: suggestion.exercises.flatMap((entry) =>
        entry.origin === "added"
          ? [{ exercise_id: entry.exercise_id, reasons: entry.reasons }]
          : [],
      ),
    },
    params_version: SUGGEST_PARAMS_V2.version,
  });
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join(".") || "(suggestion)")),
    ];
    throw new RangeError(`The accepted suggestion is not valid at ${fields.join(", ")}`);
  }
  return result.data;
}

/**
 * Soft deletes the user's live accepted suggestion for the day, and resolves to the ids it deleted (none
 * when there was no live row). The table has no delete grant: a row is only ever undone.
 */
async function softDeleteDay(
  client: SupabaseClient<Database>,
  localDate: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("accepted_suggestions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("local_date", localDate)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    throw trainingRepoError("accept the suggestion", error);
  }
  return data.map(({ id }) => id);
}

/** Puts back the rows an accept soft deleted, after the insert was refused. A failure here is not reported: the accept's own error is. */
async function restoreRows(
  client: SupabaseClient<Database>,
  ids: readonly string[],
): Promise<void> {
  if (ids.length > 0) {
    await client
      .from("accepted_suggestions")
      .update({ deleted_at: null })
      .in("id", [...ids]);
  }
}

/**
 * Accepts the suggestion into the day `localDate`, so it counts as planned in the projection, and
 * resolves to the row as stored (its id is the Undo's). Only the exercises the suggestion added are
 * stored (`toAcceptedExercises`), with the reasons behind each pick and the params version, and the
 * stored shape is checked by core's `acceptedSuggestionSchema` first, so a row the projection would skip
 * is never written. A suggestion with nothing to add, a day that is not a calendar day, a routine day id
 * that is not a UUID and an exercise the library lacks throw a `RangeError` stating the rule and quoting
 * no value, before any request.
 *
 * A day holds one live accepted suggestion: the one already there is soft deleted first and the new row
 * inserted, and when the partial unique index refuses it (23505, another device accepted for the day in
 * between) the pair is run once more. When the insert is refused for any other reason, such as a routine
 * day that is not the caller's (42501, the same as one that does not exist), the rows soft deleted are put
 * back on a best effort basis: the restore is a second request whose own error is ignored, so a dropped
 * connection or a closed tab between the two requests leaves the day with no live suggestion, and after
 * a retry only the ids soft deleted by the last pass are restored. A failure throws with the action and
 * the database code only.
 */
export async function acceptSuggestion(
  client: SupabaseClient<Database>,
  accept: AcceptSuggestion,
): Promise<AcceptedSuggestionRow> {
  const row = insertOf(accept);

  let lostRace = false;
  for (;;) {
    const replaced = await softDeleteDay(client, row.local_date);
    const { data, error } = await client
      .from("accepted_suggestions")
      .insert(row)
      .select(ACCEPTED_COLUMNS)
      .single();
    if (error === null) {
      return readStored(data);
    }
    if (error.code === DAY_TAKEN && !lostRace) {
      lostRace = true;
      continue;
    }
    await restoreRows(client, replaced);
    throw trainingRepoError("accept the suggestion", error);
  }
}

function readStored(row: unknown): AcceptedSuggestionRow {
  const { suggestions, skipped } = readRows([row]);
  const [stored] = suggestions;
  if (stored === undefined) {
    const [problem] = skipped;
    throw new Error(
      `Could not accept the suggestion: row ${problem?.id ?? "(unknown)"} has an unexpected shape at ${problem?.fieldPaths.join(", ") ?? "(row)"}`,
    );
  }
  return stored;
}

/**
 * Undoes an accept by soft deleting the row (the Undo of the toast "Added to Thursday", which holds the
 * id `acceptSuggestion` resolved to), so it leaves the projection once the week is read again. A row that
 * is already undone changes nothing. A row that does not exist or is not the caller's fails with the code
 * PGRST116, the same in both cases, and an id that is not a UUID throws a `RangeError` before any
 * request.
 */
export async function undoAcceptedSuggestion(
  client: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  if (!ROW_ID.safeParse(id).success) {
    throw new RangeError("An accepted suggestion id must be a UUID");
  }

  const { data, error } = await client
    .from("accepted_suggestions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    throw trainingRepoError("undo adding the suggestion", error);
  }

  if (data.length === 0) {
    const existing = await client.from("accepted_suggestions").select("id").eq("id", id).single();
    if (existing.error) {
      throw trainingRepoError("undo adding the suggestion", existing.error);
    }
  }
}
