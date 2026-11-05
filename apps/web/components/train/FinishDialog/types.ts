import type { FinishDetails } from "@keylow/api-client";

export type FinishDialogProps = {
  /** What the session stood at when Finish was pressed. The dialog does not follow the session after that. */
  details: FinishDetails;
  /** The note as typed. The session page holds it, so Keep logging does not drop it. */
  note: string;
  onChangeNote: (note: string) => void;
  /** Closes the dialog and saves nothing. */
  onKeepLogging: () => void;
  /** Called once the session is saved. The page answers with the toast. */
  onSaved: () => void;
};
