export type SwitchToManualDialogProps = {
  open: boolean;
  /** The save is on its way: Save my targets is busy, and the dialog cannot be closed until it ends. */
  isSaving: boolean;
  /** Keep my programme, Escape and a press on the dimmed page. Nothing is saved. */
  onKeepProgramme: () => void;
  onSaveMyTargets: () => void;
};
