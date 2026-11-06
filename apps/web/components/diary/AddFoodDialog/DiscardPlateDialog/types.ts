export type DiscardPlateDialogProps = {
  open: boolean;
  /** How many foods are on the plate, which the question names. */
  count: number;
  /** Keep adding: takes the question away and leaves the plate as it was. Close and Escape do the same. */
  onKeepAdding: () => void;
  /** Throws the plate away and closes the Add food dialog. */
  onDiscard: () => void;
};
