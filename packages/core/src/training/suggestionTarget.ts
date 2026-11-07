import { SESSION_TIME_PARAMS_V1 } from "./sessionTime";
import { todayCard } from "./todayCard";
import { weekPlanDays } from "./weekPlanDays";
import { addCalendarDays } from "../dates/calendarDay";
import { toLocalDate } from "../dates/toLocalDate";

import type { TodayCard } from "./todayCard";
import type { WeekPlan, WeekPlanInput, WeekSession } from "./weekPlanDays";

/*
 * Which day the suggestion is for, and the Today card it is read from. The suggestion card of the Train home
 * and the assistant's `suggest_next_session` both ask here, so the assistant gives the answer the card shows.
 * Pure under the ADR 0002 rule: `now` is an argument.
 */

/**
 * The week's sessions with the one in progress among them, dated `localDate`. The session in progress is read
 * on its own, so it can be newer than the week's rows (a session just started, or a set just logged), and it
 * can have started on an earlier day (one that crosses midnight, or is left open): the database allows one
 * open session, so the Today card must offer Resume for it on whatever day it is, never Start. Core's week
 * plan puts a session on the day it started and would drop it, or leave it on yesterday, so it takes the place
 * of its own row on `localDate`: today for the card.
 */
export const withSessionInProgress = (
  weekSessions: readonly WeekSession[],
  sessionInProgress: WeekSession | null,
  localDate: string,
): readonly WeekSession[] =>
  sessionInProgress === null
    ? weekSessions
    : [
        ...weekSessions.filter((session) => session.id !== sessionInProgress.id),
        { ...sessionInProgress, local_date: localDate },
      ];

export type TodayPlanInput = Omit<WeekPlanInput, "sessions"> &
  Readonly<{
    weekSessions: readonly WeekSession[];
    sessionInProgress: WeekSession | null;
    hasEverLoggedSession: boolean;
  }>;

/** The week plan with the session in progress dated today, and the Today card read from it. */
export const todayPlanOf = ({
  weekSessions,
  sessionInProgress,
  hasEverLoggedSession,
  ...week
}: TodayPlanInput): { plan: WeekPlan; card: TodayCard } => {
  const plan = weekPlanDays({
    ...week,
    sessions: withSessionInProgress(
      weekSessions,
      sessionInProgress,
      toLocalDate(new Date(week.now), week.tz),
    ),
  });
  return {
    plan,
    card: todayCard({
      week: plan,
      now: week.now,
      sessionTimeParams: SESSION_TIME_PARAMS_V1,
      hasEverLoggedSession,
    }),
  };
};

/** The day a suggestion is for, and the routine day it adds to (null for a session that follows no routine day). */
export type SuggestionTarget = Readonly<{
  /** `YYYY-MM-DD`. */
  day: string;
  routineDayId: string | null;
  routineDayName: string | null;
  /** Whether today is a rest day, so the day is the next planned one. */
  isRestDay: boolean;
}>;

export type SuggestionTargetRead =
  | Readonly<{ status: "day"; target: SuggestionTarget }>
  /** A session is open: the card has nothing to suggest. */
  | Readonly<{ status: "in_progress" }>
  /** Today's session is finished: the suggestion is for the day after, which is `next`. */
  | Readonly<{ status: "done"; next: SuggestionTarget }>
  /** The first visit, which has its own Set your goal. */
  | Readonly<{ status: "none" }>;

export type SuggestionTargetInput = Readonly<{
  /** Today in the user's zone, `YYYY-MM-DD`. */
  today: string;
  /** The Today card, or null where the Train home has none: the first visit and no routine. */
  card: TodayCard | null;
  /** The routine day today plans, or null when it plans none. */
  plannedDayId: string | null;
  hasRoutine: boolean;
  /** Whether a session was ever logged, which tells the first visit from no routine. */
  hasLoggedSession: boolean;
}>;

/**
 * The day the suggestion is asked for, from the Today card: the next planned day on a rest day, today on a
 * planned day, and tomorrow, as a session that follows no routine day, when there is no routine day to add
 * to. No suggestion on the first visit (it has its own Set your goal), while a session runs, and once it
 * is done the card has none either, so `done` gives the day after for a caller that wants it.
 */
export const suggestionTargetOf = ({
  today,
  card,
  plannedDayId,
  hasRoutine,
  hasLoggedSession,
}: SuggestionTargetInput): SuggestionTargetRead => {
  const fresh = (isRestDay: boolean): SuggestionTarget => ({
    day: addCalendarDays(today, 1),
    routineDayId: null,
    routineDayName: null,
    isRestDay,
  });
  const nextDay = (
    next: { date: string; id: string; name: string } | null,
    isRestDay: boolean,
  ): SuggestionTarget =>
    next === null
      ? fresh(isRestDay)
      : { day: next.date, routineDayId: next.id, routineDayName: next.name, isRestDay };

  switch (card?.kind) {
    case "planned":
      // Today's suggestion is stored under the day today plans, so the projection folds it into that day and
      // the session started from the day takes it up. The day is null only if the plan places none today.
      return {
        status: "day",
        target: {
          day: today,
          routineDayId: plannedDayId,
          routineDayName: card.dayName,
          isRestDay: false,
        },
      };
    case "rest":
      return { status: "day", target: nextDay(card.next, true) };
    case "in_progress":
      return { status: "in_progress" };
    case "done":
      return { status: "done", next: nextDay(card.next, false) };
    case "no_routine":
    case "first_time":
    case undefined:
      return hasRoutine || !hasLoggedSession
        ? { status: "none" }
        : { status: "day", target: fresh(false) };
  }
};
