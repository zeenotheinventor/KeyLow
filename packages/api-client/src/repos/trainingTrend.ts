import { bestSetPerWeek } from "@keylow/core/training";
import { z } from "zod";

import { parseRow } from "./diaryRows";
import { trainingRepoError, trainingWeekBounds } from "./training";
import { TREND_SET_SELECT, trendSetRowSchema } from "./trainingSchemas";
import { weekStartOf } from "../weekStartOf";

import type { TrendSetRow, TrendSetRows } from "./trainingSchemas";
import type { Database } from "../database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

// A set holds a load and the reps of an exercise: health data. A failure here names the action and the
// error code only, and the cause holds the code and nothing else, because the database's own message and
// details can quote the row that failed.

const ROW_ID = z.guid();
const LOCAL_DATE = z.iso.date();

/** The most rows PostgREST returns for one request (`max_rows` in `packages/db/supabase/config.toml`). */
const PAGE_SIZE = 1000;

/**
 * The most rows one pass of the earlier read takes for each exercise it still looks for. It reads newest
 * first and keeps the week of each exercise's newest set, so a week of one exercise with more sets than
 * this loses its oldest.
 */
const EARLIER_ROWS_PER_EXERCISE = 200;

const ROW_LABEL = () => "(trend row)";

const parseTrendRow = (row: unknown): TrendSetRow =>
  parseRow(trendSetRowSchema, row, "read the trend", ROW_LABEL);

/** The earlier rows of each exercise reduced to the week of its newest set, which is the week to compare with. */
function lastTrainedWeekOfEach(rows: readonly TrendSetRow[]): TrendSetRow[] {
  const newestDay = new Map<string, string>();
  for (const { exercise_id, local_date } of rows) {
    const newest = newestDay.get(exercise_id);
    if (newest === undefined || local_date > newest) {
      newestDay.set(exercise_id, local_date);
    }
  }
  return rows.filter(
    ({ exercise_id, local_date }) =>
      weekStartOf(local_date) === weekStartOf(newestDay.get(exercise_id) ?? local_date),
  );
}

/**
 * What the weekly exercise trend works from, for some exercises at once: the signed in user's live
 * working sets (every type but a warm-up) of these exercises in live sessions whose `local_date` is from
 * the Monday `fromWeek` through `throughDay`, both `YYYY-MM-DD`; and `earlier`, the sets of the last week
 * each exercise was trained before `fromWeek`, so the first trained week of the range has something to
 * compare with. Rows only, narrow, because they are kept on the device. Sets of a session that is still
 * open are included.
 *
 * The range is reduced to the best set of each exercise and week (core's `bestSetPerWeek`), which is the
 * only set the trend reads of a week, so a year of a routine is a few hundred rows and not thousands. It
 * is read a page at a time (the API returns at most 1,000 rows to a request) and then reduced, oldest
 * week first. `earlier` is read newest first, a pass at a time: a pass asks for the exercises not yet
 * seen, up to 200 rows each, and the next asks for the ones the last pass did not find, so a busy
 * exercise cannot push a rare one out. Each pass that returns rows removes at least one exercise, and
 * the first that returns none ends the reading. Row level security shows a user their own sets only.
 *
 * Throws a `RangeError` before any request for an id that is not a UUID, a `fromWeek` that is not a
 * Monday or a `throughDay` that is not a date. No exercise asked for makes no request.
 */
export async function listTrendSets(
  client: SupabaseClient<Database>,
  exerciseIds: readonly string[],
  { fromWeek, throughDay }: { fromWeek: string; throughDay: string },
): Promise<TrendSetRows> {
  if (!exerciseIds.every((id) => ROW_ID.safeParse(id).success)) {
    throw new RangeError("An exercise id must be a UUID");
  }
  trainingWeekBounds(fromWeek);
  if (!LOCAL_DATE.safeParse(throughDay).success) {
    throw new RangeError("A training day must be a calendar date written YYYY-MM-DD");
  }

  // Lower case, as the database gives a uuid back, so an id asked for is matched to the rows it finds.
  const ids = [...new Set(exerciseIds.map((id) => id.toLowerCase()))];
  if (ids.length === 0) {
    return { sets: [], earlier: [] };
  }

  const rangeRows: TrendSetRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from("workout_sets")
      .select(TREND_SET_SELECT)
      .in("exercise_id", ids)
      .neq("set_type", "warmup")
      .is("deleted_at", null)
      .is("workout_sessions.deleted_at", null)
      .gte("workout_sessions.local_date", fromWeek)
      .lte("workout_sessions.local_date", throughDay)
      .order("performed_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw trainingRepoError("load your trend", error);
    }

    rangeRows.push(...data.map(parseTrendRow));

    if (data.length < PAGE_SIZE) {
      break;
    }
  }

  const earlierRows: TrendSetRow[] = [];
  for (let unseen = ids; unseen.length > 0;) {
    const { data, error } = await client
      .from("workout_sets")
      .select(TREND_SET_SELECT)
      .in("exercise_id", unseen)
      .neq("set_type", "warmup")
      .is("deleted_at", null)
      .is("workout_sessions.deleted_at", null)
      .lt("workout_sessions.local_date", fromWeek)
      .order("performed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(unseen.length * EARLIER_ROWS_PER_EXERCISE);

    if (error) {
      throw trainingRepoError("load your trend", error);
    }
    if (data.length === 0) {
      break;
    }

    const rows = data.map(parseTrendRow);
    const seen = new Set(rows.map(({ exercise_id }) => exercise_id));
    earlierRows.push(...rows);
    const stillUnseen = unseen.filter((id) => !seen.has(id));
    // A pass that finds none of the exercises it asked for would be repeated without end.
    if (stillUnseen.length === unseen.length) {
      break;
    }
    unseen = stillUnseen;
  }

  return { sets: bestSetPerWeek(rangeRows), earlier: lastTrainedWeekOfEach(earlierRows) };
}
