import type { WorkoutSessionRow } from "@keylow/core/schemas";
import type { ReactNode } from "react";

export type SessionClockProps = {
  /** The routine day's name, or null for a session that follows none. */
  dayName: string | null;
  startedAt: WorkoutSessionRow["started_at"];
  endedAt: WorkoutSessionRow["ended_at"];
  setsLogged: number;
  /** 0 when the session follows no routine day. */
  setsPlanned: number;
  onHide: () => void;
  /** What stands at the right of the header, such as the More control. */
  trailingSlot?: ReactNode;
};
