import type { WorkoutSessionRow } from "@keylow/core/schemas";

export type SessionClockProps = {
  /** The routine day's name, or null for a session that follows none. */
  dayName: string | null;
  startedAt: WorkoutSessionRow["started_at"];
  endedAt: WorkoutSessionRow["ended_at"];
  setsLogged: number;
  /** 0 when the session follows no routine day. */
  setsPlanned: number;
  onHide: () => void;
};
