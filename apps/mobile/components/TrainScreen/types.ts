export type TrainScreenProps = {
  /**
   * Starts a session that follows no routine day: "Log a session" on the first visit and "Log a session
   * anyway" with no routine. The screen draws each of those buttons only when it is given.
   */
  onLogSession?: (() => void) | undefined;
  /** Opens the routine editor: "Create routine". Drawn only when it is given. */
  onCreateRoutine?: (() => void) | undefined;
  /** Opens the goal questionnaire: "Set your goal". Drawn only when it is given. */
  onSetGoal?: (() => void) | undefined;
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
      /** The profile's IANA time zone, UTC when the profile row is missing. */
      timeZone: string;
      /** When the oldest of the reads was made, which is how old the screen's content is. */
      savedAt: Date;
    };
