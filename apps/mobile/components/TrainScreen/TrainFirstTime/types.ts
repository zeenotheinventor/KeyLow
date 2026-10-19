export type TrainFirstTimeProps = {
  onSetGoal?: (() => void) | undefined;
  onLogSession?: (() => void) | undefined;
  /** Dims "Log a session" and stops it responding, since starting a session needs a connection. */
  isLogDisabled: boolean;
  /** Shows a spinner on "Log a session" and stops it responding, while the session is being started. */
  isStarting?: boolean | undefined;
};
