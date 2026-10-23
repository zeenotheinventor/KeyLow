import { summariseSession } from "@keylow/core/training";

import type { HistorySessionRow } from "../repos/trainingSchemas";
import type { SessionSummary, SessionWeek } from "@keylow/core/training";

/** A session of the history list: the stored rows, and what core works out from them at read time. */
export type HistoryEntry = HistorySessionRow & { summary: SessionSummary };

/** A calendar week of the history list, Monday to Sunday, with its totals and its sessions newest first. */
export type HistoryWeek = SessionWeek<HistoryEntry>;

/**
 * The sessions with their summaries (core's `summariseSession`). A summary compares nothing with a routine:
 * a past session shows what was done. The title is the day's name as the session row read it, so a session
 * of a day the active routine no longer holds keeps its name.
 */
export function toHistoryEntries(sessions: readonly HistorySessionRow[]): HistoryEntry[] {
  return sessions.map((session) => ({
    ...session,
    summary: {
      ...summariseSession(session, session.sets),
      titleSource: session.routine_day_name,
    },
  }));
}
