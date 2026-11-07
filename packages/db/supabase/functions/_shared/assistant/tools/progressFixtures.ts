// The sets of one exercise that `get_exercise_progress`'s tests read, as the trend read selects them. Nothing in
// production imports this.
import { addCalendarDays, daysSinceMonday } from "../../core.ts";

import type { TrendSet } from "../../core.ts";

type SetType = TrendSet["set_type"];

// A `workout_sets` row with the day of its session embedded, as `listTrendSets` selects it.
export const trendSetRow = (
  exerciseId: string,
  localDate: string,
  { loadKg, reps }: { loadKg: number | null; reps: number },
  overrides: Record<string, unknown> = {},
) => ({
  exercise_id: exerciseId,
  set_type: "working" as SetType,
  reps,
  load_kg: loadKg,
  deleted_at: null,
  workout_sessions: { local_date: localDate, deleted_at: null },
  ...overrides,
});

export const mondayOf = (localDate: string) =>
  addCalendarDays(localDate, -daysSinceMonday(localDate));

// One working set a week for `weeks` weeks, the latest in the week of `today`. `loadKgOfWeek` is given the
// number of weeks before the latest, so a test chooses the shape of the progress.
export const weeklyRows = (
  exerciseId: string,
  today: string,
  weeks: number,
  loadKgOfWeek: (weeksBack: number) => number,
) =>
  Array.from({ length: weeks }, (_, index) => {
    const weeksBack = weeks - 1 - index;
    return trendSetRow(exerciseId, addCalendarDays(mondayOf(today), -7 * weeksBack), {
      loadKg: loadKgOfWeek(weeksBack),
      reps: 8,
    });
  });

// The sets as the trend reads them: what the screen's own reader is given from the same rows.
export const trendSetsOf = (rows: ReturnType<typeof trendSetRow>[]): TrendSet[] =>
  rows.map((row) => ({
    set_type: row.set_type,
    reps: row.reps,
    load_kg: row.load_kg,
    local_date: row.workout_sessions.local_date,
  }));
