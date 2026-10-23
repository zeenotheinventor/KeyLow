import type { WorkoutSessionRow } from "@keylow/core/schemas";

export type SessionBarProps = {
  /** The routine day's name, or null for a session that follows none. */
  dayName: string | null;
  startedAt: WorkoutSessionRow["started_at"];
  setsLogged: number;
  /** 0 when the session follows no routine day, or its day is not in the active routine. */
  setsPlanned: number;
  onPress: () => void;
};

/** What the bar shows of the open session, and how it opens it. */
export type SessionBarView = SessionBarProps;
