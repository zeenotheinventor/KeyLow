import type { TodayCardContext, TodayCardWithSession } from "@keylow/core/copy";
import type { WeekPlan } from "@keylow/core/training";

/** A day of the active routine as the Pick day sheet lists it. */
export type PickDayOption = {
  id: string;
  name: string;
  /** The day's date this week, `YYYY-MM-DD`, or null for a day with no weekday. */
  date: string | null;
  exerciseCount: number;
  setCount: number;
};

/** The Today card for today: what `todayCard` gave and what its words need besides it. */
export type TodayCardView = {
  card: TodayCardWithSession;
  context: TodayCardContext;
  /** The routine day today plans, which Start follows, or null when today plans none. */
  plannedDayId: string | null;
  /** The finished session View session opens: the one that ended last of those the Done card counts. Null for any other card. */
  sessionToViewId: string | null;
};

/** The week strip's week: core's plan, which already holds the session in progress, and its Monday. */
export type TrainWeekView = {
  plan: WeekPlan;
  /** The Monday of the week, `YYYY-MM-DD`. */
  weekStart: string;
};

/** What the Train home has read. */
export type TrainHome =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | {
      status: "ready";
      hasRoutine: boolean;
      /** The active routine's id, or null with no routine. */
      routineId: string | null;
      /** Whether the user has ever logged a session, which tells the first visit from no routine. */
      hasLoggedSession: boolean;
      /**
       * The Today card, or null when today has none: with no routine and nothing logged today the first-time
       * or no routine card stands in its place.
       */
      today: TodayCardView | null;
      /** The week strip's week, or null when there is nothing to show: no routine day and no session in the week. */
      week: TrainWeekView | null;
      /** The active routine's days in routine order, which Pick day lists. Empty with no routine. */
      routineDays: readonly PickDayOption[];
      /** The profile's IANA time zone, UTC when the profile row is missing. */
      timeZone: string;
      /** When the oldest of the reads was made, which is how old the screen's content is. */
      savedAt: Date;
    };

/** What the Train home needs from the platform it runs on. */
export type TrainHomeSettings = {
  /** The current moment, which the platform moves on once a minute. */
  now: Date;
  /** Whether the reads may run: the account has accepted the current Terms. */
  enabled: boolean;
};
