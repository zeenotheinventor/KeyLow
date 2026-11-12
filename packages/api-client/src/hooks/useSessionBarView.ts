import { planProgress, scaffoldSessionWithAdditions } from "@keylow/core/training";
import { useMemo } from "react";

import { weekStartOf } from "../weekStartOf";
import { useAcceptedSuggestions } from "./useAcceptedSuggestions";
import { useActiveRoutine } from "./useActiveRoutine";
import { useActiveSession } from "./useActiveSession";
import { useRoutine } from "./useRoutine";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { WorkoutSessionRow } from "@keylow/core/schemas";

/** What the session bar shows of the open session. The time is not here: the bar reads it itself. */
export type SessionBarView = {
  /** The routine day's name, or null for a session that follows none. */
  dayName: string | null;
  startedAt: WorkoutSessionRow["started_at"];
  setsLogged: number;
  /** 0 when the session follows no routine day, or its day is not in the active routine. */
  setsPlanned: number;
};

// The week asked for while there is no session to ask about, which is never read.
const NO_WEEK = "1970-01-05";

/**
 * What the session bar shows, or null when there is no bar: no session is open (or `enabled` is false), or
 * the session is still being read. The bar shows as soon as the session is read, with its sets and no
 * total. The total joins when the day's plan lands, so a slow or hung routine read never hides the bar.
 * Nothing reads a routine unless an open session follows one of its days. A plan that cannot be had (the
 * device is offline and has not saved it, the read failed, or the day is no longer in the active routine)
 * leaves the sets without a total. The suggestion accepted for the session's date and routine day adds its
 * sets to that total (`scaffoldSessionWithAdditions`, the plan the session screen reads too), and the total
 * waits for that read like the plan. The sets are the ones the database holds: a set still being saved on
 * the session screen joins the bar when its write lands. The time is not read here, because the bar ticks
 * by itself. Every read follows `enabled`, which the phone sets false under the terms gate.
 */
export function useSessionBarView({
  enabled = true,
}: DiaryReadOptions = {}): SessionBarView | null {
  const session = useActiveSession({ enabled });
  const open = session.data;
  const followsRoutineDay = open?.routine_day_id !== null && open?.routine_day_id !== undefined;
  const planEnabled = enabled && followsRoutineDay;
  const routine = useActiveRoutine({ enabled: planEnabled });
  const detail = useRoutine(routine.data?.id, { enabled: planEnabled });
  const accepted = useAcceptedSuggestions(
    open === null || open === undefined ? NO_WEEK : weekStartOf(open.local_date),
    { enabled: enabled && open !== null && open !== undefined },
  );

  const day = detail.data?.days.find((entry) => entry.id === open?.routine_day_id) ?? null;
  // The total waits for the accepted suggestions, so it never reads 16 and then 19. A read that failed or is
  // paused for want of a connection with nothing saved leaves the additions out.
  const acceptedRows = accepted.data?.suggestions;
  const isAcceptedPending = acceptedRows === undefined && accepted.fetchStatus === "fetching";

  const progress = useMemo(() => {
    const scaffold =
      open === null || open === undefined || isAcceptedPending
        ? null
        : scaffoldSessionWithAdditions(open, day, acceptedRows ?? []).scaffold;
    return planProgress(scaffold, open?.sets ?? []);
  }, [open, day, acceptedRows, isAcceptedPending]);

  if (open === null || open === undefined) {
    return null;
  }

  return {
    dayName: open.routine_day_name,
    startedAt: open.started_at,
    setsLogged: progress.logged,
    setsPlanned: progress.planned ?? 0,
  };
}
