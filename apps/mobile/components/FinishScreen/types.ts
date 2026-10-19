/** What the finish screen shows of the session, worked out when Finish is pressed. */
export type FinishDetails = {
  sessionId: string;
  /** The routine day's name, or null for a session that follows none. */
  dayName: string | null;
  startedAt: string;
  /** The working, drop and failure sets logged. */
  workingSets: number;
  /** The sets the plan asks for, or null for a session with no plan. */
  plannedSets: number | null;
  warmups: number;
  exercisesLogged: number;
  /** The exercises the plan has, or null for a session with no plan. */
  exercisesPlanned: number | null;
  /** The sentence naming the planned sets left alone, or null when none are. */
  notLoggedNote: string | null;
};

/** How the screen stood when the session was saved. */
export type SavedOutcome = {
  /** False when the save landed after the screen had closed, so there is no screen left to leave. */
  isScreenOpen: boolean;
};

export type FinishScreenProps = {
  details: FinishDetails;
  /** The note as typed. The session screen holds it, so Keep logging does not drop it. */
  note: string;
  onChangeNote: (note: string) => void;
  /** Goes back to the session, saving nothing. */
  onKeepLogging: () => void;
  /** Called once the session is saved: the route answers with the toast and, if the screen is still open, leaves. */
  onSaved: (outcome: SavedOutcome) => void;
};
