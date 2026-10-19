import type { TrainSessionStart } from "../TrainScreen";

export type HistoryScreenProps = {
  /** Opens a session of the list, given its id: a row was pressed. */
  onOpenSession: (sessionId: string) => void;
  /** Goes back to the Train home. */
  onBack: () => void;
  /**
   * Starts a session that follows no routine day: "Start a session" on the empty history. Drawn only when
   * it is given, so none is a dead control.
   */
  onStartSession?: ((start: TrainSessionStart) => void) | undefined;
  /** Dims Start a session and stops it responding while a start is under way. */
  isStarting?: boolean | undefined;
};
