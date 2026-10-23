import { useActiveRoutine, useActiveSession, useRoutine } from "@keylow/api-client";
import { planProgress, scaffoldSession } from "@keylow/core/training";
import { useMemo } from "react";

import { useOpenSession } from "../../lib/useOpenSession";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { SessionBarView } from "./types";

/**
 * What the session bar shows, or null when there is no bar: no session is open, the account has not
 * accepted the Terms (every read waits for that), or the session is still being read. The bar shows as soon
 * as the session is read, with its sets and no total; the total joins when the day's plan lands, so a slow
 * or hung routine read never hides the bar. Nothing reads a routine unless an open session follows one of
 * its days. A plan that cannot be had (the phone is offline and has not saved it, the read failed, or the
 * day is no longer in the active routine) leaves the sets without a total. The sets are the ones the
 * database holds: a set still being saved on the session screen joins the bar when its write lands. Each
 * read is saved on the phone, so the bar shows offline from the saved session. The time is not read here,
 * because the bar ticks by itself.
 */
export function useSessionBar(): SessionBarView | null {
  const enabled = useReadsEnabled();
  const session = useActiveSession({ enabled });
  const open = session.data;
  const followsRoutineDay = open?.routine_day_id !== null && open?.routine_day_id !== undefined;
  const planEnabled = enabled && followsRoutineDay;
  const routine = useActiveRoutine({ enabled: planEnabled });
  const detail = useRoutine(routine.data?.id, { enabled: planEnabled });
  const onPress = useOpenSession();

  const day = detail.data?.days.find((entry) => entry.id === open?.routine_day_id) ?? null;

  const progress = useMemo(
    () => planProgress(day === null ? null : scaffoldSession(day), open?.sets ?? []),
    [day, open?.sets],
  );

  if (open === null || open === undefined) {
    return null;
  }

  return {
    dayName: open.routine_day_name,
    startedAt: open.started_at,
    setsLogged: progress.logged,
    setsPlanned: progress.planned ?? 0,
    onPress,
  };
}
