import type { FinishDetails } from "@keylow/api-client";

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
