import { summariseSession } from "@keylow/core/training";

import type { ActiveRoutine, HistorySessionRow } from "../repos/trainingSchemas";
import type { HistoryPlanDay, SessionSummary, SessionWeek } from "@keylow/core/training";

/** A session of the history list: the stored rows, and what core works out from them at read time. */
export type HistoryEntry = HistorySessionRow & { summary: SessionSummary };

/** A calendar week of the history list, Monday to Sunday, with its totals and its sessions newest first. */
export type HistoryWeek = SessionWeek<HistoryEntry>;

// The day a session was planned from, as far as the active routine still holds it. A session of a day
// that was removed, or of a routine that is no longer active, is compared with nothing.
const plannedDayOf = (
  session: HistorySessionRow,
  routine: ActiveRoutine | null | undefined,
): HistoryPlanDay | undefined => {
  const day = routine?.days.find(({ id }) => id === session.routine_day_id);
  return day === undefined ? undefined : { name: day.name, exercises: day.exercises };
};

/**
 * The sessions with their summaries (core's `summariseSession`), compared with the routine day they were
 * planned from when the active routine still holds it. The title is the day's name as the session row
 * read it, so a session of a day the active routine no longer holds keeps its name.
 */
export function toHistoryEntries(
  sessions: readonly HistorySessionRow[],
  routine: ActiveRoutine | null | undefined,
): HistoryEntry[] {
  return sessions.map((session) => ({
    ...session,
    summary: {
      ...summariseSession(session, session.sets, plannedDayOf(session, routine)),
      titleSource: session.routine_day_name,
    },
  }));
}
