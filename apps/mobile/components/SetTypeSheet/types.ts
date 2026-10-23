import type { SetType } from "@keylow/core/training";

export type SetTypeSheetProps = {
  open: boolean;
  /** Called when the person closes the sheet without choosing: the dim, a drag down, the back button. */
  onClose: () => void;
  exerciseName: string;
  /** The set's type now: its row is the checked one. */
  setType: SetType;
  /**
   * The number the set has among the exercise's working sets, or would have if it were one. It is drawn
   * on the Working row and in the sheet's name, so a warm-up still shows what it becomes.
   */
  setNumber: number;
  /** Called with the type that was pressed, the checked one included. The screen decides what to do and closes the sheet. */
  onChoose: (setType: SetType) => void;
};
