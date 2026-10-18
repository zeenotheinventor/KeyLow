import {
  planRoutineOf,
  useActiveRoutine,
  useActiveSession,
  useHasLoggedSession,
  useProfileTimeZone,
  useWeekSessionRows,
  weekStartOf,
} from "@keylow/api-client";
import { toLocalDate } from "@keylow/core/dates";
import { SESSION_TIME_PARAMS_V1, todayCard, weekPlanDays } from "@keylow/core/training";

import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { TodayCardView, TrainHome } from "./types";
import type { ActiveRoutine } from "@keylow/api-client";
import type { TodayCard, WeekSession } from "@keylow/core/training";

/**
 * The week's sessions with the one in progress among them, dated today. The session in progress is read on
 * its own, so it can be newer than the week's rows (a session just started, or a set just logged), and it
 * can have started on an earlier day (one that crosses midnight, or is left open): the database allows one
 * open session, so the card must offer Resume for it on whatever day it is, never Start. Core's week plan
 * puts a session on the day it started and would drop it, or leave it on yesterday, so it takes the place
 * of its own row and the day it is read on.
 */
function withSessionInProgress(
  weekSessions: readonly WeekSession[],
  sessionInProgress: WeekSession | null,
  today: string,
): readonly WeekSession[] {
  if (sessionInProgress === null) {
    return weekSessions;
  }
  return [
    ...weekSessions.filter((session) => session.id !== sessionInProgress.id),
    { ...sessionInProgress, local_date: today },
  ];
}

/** The exercise as the catalogue stores it, or null when the routine does not hold it. */
function exerciseNameIn(routine: ActiveRoutine | null, exerciseId: string): string | null {
  const planned = routine?.days
    .flatMap((day) => day.exercises)
    .find((exercise) => exercise.exercise_id === exerciseId);
  return planned?.exercise.name ?? null;
}

/** `null` for the two cards that have components of their own: the first visit and no routine. */
function todayViewOf(
  card: TodayCard,
  routine: ActiveRoutine | null,
  localDate: string,
): TodayCardView | null {
  if (card.kind === "first_time" || card.kind === "no_routine") {
    return null;
  }
  return {
    card,
    context: {
      localDate,
      nextExerciseName:
        card.kind === "in_progress" && card.nextSet !== null
          ? exerciseNameIn(routine, card.nextSet.exerciseId)
          : null,
      // The muscles still recovering wait on a grouping rule no board draws, so the rest card names the next day alone.
      recovery: null,
    },
  };
}

/**
 * What the Train home shows, from the reads it waits on: the profile's time zone, the active routine, the
 * sessions of the week that holds today, the session in progress and, only when there is no routine,
 * whether any session was ever logged (a routine already says it is not a first visit, so the read is not
 * made). Every read waits until the account has accepted the current Terms. The Today card is core's
 * `todayCard` over them at the current minute, which `useNow` moves on once a minute. The minute is
 * never in a query key: the week reads under its Monday, so a tick only works the card out again. It is
 * ready once the reads it needs are there, from the cache too, so it works offline. A read that fails while
 * there is nothing to show is an error, and a refetch that fails behind content that is already there is
 * not. `retry` reads again the ones that are being used. The week strip joins the reads here.
 */
export function useTrainHome(): TrainHome {
  const enabled = useReadsEnabled();
  const now = useNow();
  const timeZone = useProfileTimeZone({ enabled });
  const routine = useActiveRoutine({ enabled });
  const everLogged = useHasLoggedSession({ enabled: enabled && routine.data === null });

  // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
  const zone = timeZone.data === undefined ? undefined : (timeZone.data ?? "UTC");
  const weekStart = zone === undefined ? null : weekStartOf(toLocalDate(now, zone));
  const week = useWeekSessionRows({ weekStart, ready: zone !== undefined, enabled });
  const sessionInProgress = useActiveSession({ enabled });

  const needsEverLogged = routine.data === null;
  const reads = needsEverLogged
    ? [timeZone, routine, week, sessionInProgress, everLogged]
    : [timeZone, routine, week, sessionInProgress];

  if (reads.some((read) => read.isError && read.data === undefined)) {
    return {
      status: "error",
      retry: () => {
        for (const read of reads) {
          void read.refetch();
        }
      },
    };
  }

  if (
    zone === undefined ||
    weekStart === null ||
    routine.data === undefined ||
    week.data === undefined ||
    sessionInProgress.data === undefined ||
    (needsEverLogged && everLogged.data === undefined)
  ) {
    return { status: "loading" };
  }

  const at = now.toISOString();
  const today = toLocalDate(now, zone);
  const plan = weekPlanDays({
    routine: planRoutineOf(routine.data, zone),
    sessions: withSessionInProgress(week.data, sessionInProgress.data, today),
    now: at,
    tz: zone,
    weekStart,
  });
  const card = todayCard({
    week: plan,
    now: at,
    sessionTimeParams: SESSION_TIME_PARAMS_V1,
    hasEverLoggedSession: everLogged.data === true,
  });

  return {
    status: "ready",
    hasRoutine: routine.data !== null,
    hasLoggedSession: everLogged.data === true,
    today: todayViewOf(card, routine.data, plan.today),
    timeZone: zone,
    savedAt: new Date(Math.min(...reads.map((read) => read.dataUpdatedAt))),
  };
}
