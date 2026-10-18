export type TrainNoRoutineProps = {
  onCreateRoutine?: (() => void) | undefined;
  onLogSession?: (() => void) | undefined;
  /** Dims "Log a session anyway" and stops it responding, since starting a session needs a connection. */
  isLogDisabled: boolean;
};
