import type { ScreenSet } from "@keylow/api-client";

export type DiscardSessionDialogProps = {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  dayName: string | null;
  /** Every set of the session, which the dialog counts. */
  sets: readonly ScreenSet[];
  /** Called once the session is discarded: the page then goes on to the Train home. */
  onDiscarded: () => void;
};
