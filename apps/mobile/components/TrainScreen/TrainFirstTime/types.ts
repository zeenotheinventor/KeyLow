export type TrainFirstTimeProps = {
  onSetGoal?: (() => void) | undefined;
  onLogSession?: (() => void) | undefined;
  /** Dims "Log a session" and stops it responding, since starting a session needs a connection. */
  isLogDisabled: boolean;
};
