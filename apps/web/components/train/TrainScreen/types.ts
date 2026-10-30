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
  /** Opens a finished session, given its id: "View session" on the Today card. Drawn only when it is given. */
  onViewSession?: ((sessionId: string) => void) | undefined;
};
