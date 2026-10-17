export type StepSheetProps = {
  open: boolean;
  /** The step's place in the method, starting at 1: the title, and what the text area is called. */
  number: number;
  /** A step that is not in the method yet: its button says Add step, and there is no Remove step. */
  isNew: boolean;
  /** What is typed so far. */
  text: string;
  onChangeText: (text: string) => void;
  /** Done, or Add step. Not offered for a step past the most characters one holds. */
  onDone: () => void;
  /** Takes the step out of the method. Only a step that is in it has this. */
  onRemove: () => void;
  /** False while the step is past the most characters, when the sheet stays open. */
  isDismissible: boolean;
  /** The dim, a drag down, the screen reader's escape or the back button. The edit as typed is kept. */
  onClose: () => void;
};
