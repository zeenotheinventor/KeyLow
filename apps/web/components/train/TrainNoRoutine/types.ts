export type TrainNoRoutineProps = {
  onCreateRoutine?: (() => void) | undefined;
  onLogSession?: (() => void) | undefined;
  /** Dims "Log a session anyway" and stops it responding, since starting a session needs a connection. */
  isLogDisabled: boolean;
  /** Shows a spinner on "Log a session anyway" and stops it responding, while the session is being started. */
  isStarting?: boolean | undefined;
};
