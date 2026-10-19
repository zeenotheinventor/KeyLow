import type { TodayCardContext, TodayCardWithSession } from "@keylow/core/copy";

/** What a start needs besides the moment: the routine day to follow, or null for a free session, and the profile's zone. */
export type TrainSessionStart = {
  routineDayId: string | null;
  timeZone: string;
};

export type TrainScreenProps = {
  /** Shows a spinner on the buttons that start a session, and stops them responding, while a start is under way. */
  isStarting?: boolean | undefined;
  /**
   * Starts a session that follows no routine day: "Log a session" on the first visit and on a rest day,
   * "Log a session anyway" with no routine and "Log another session" on the Done card. The screen draws each
   * of those buttons only when it is given.
   */
  onLogSession?: ((start: TrainSessionStart) => void) | undefined;
  /** Opens the routine editor: "Create routine". Drawn only when it is given. */
  onCreateRoutine?: (() => void) | undefined;
  /** Opens the goal questionnaire: "Set your goal". Drawn only when it is given. */
  onSetGoal?: (() => void) | undefined;
  /** Starts the day's session: "Start Legs" on the Today card. Drawn only when it is given. */
  onStart?: ((start: TrainSessionStart) => void) | undefined;
  /** Reopens the session in progress: "Resume Legs" on the Today card. Drawn only when it is given. */
  onResume?: (() => void) | undefined;
  /** Opens today's finished session: "View session" on the Today card. Drawn only when it is given. */
  onViewSession?: (() => void) | undefined;
};

/** The Today card for today: what `todayCard` gave and what its words need besides it. */
export type TodayCardView = {
  card: TodayCardWithSession;
  context: TodayCardContext;
  /** The routine day today plans, which Start follows, or null when today plans none. */
  plannedDayId: string | null;
};

/** What the Train home has read. */
export type TrainHome =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | {
      status: "ready";
      hasRoutine: boolean;
      /** Whether the user has ever logged a session, which tells the first visit from no routine. */
      hasLoggedSession: boolean;
      /**
       * The Today card, or null when today has none: with no routine and nothing logged today the first-time
       * or no routine card stands in its place.
       */
      today: TodayCardView | null;
      /** The profile's IANA time zone, UTC when the profile row is missing. */
      timeZone: string;
      /** When the oldest of the reads was made, which is how old the screen's content is. */
      savedAt: Date;
    };
