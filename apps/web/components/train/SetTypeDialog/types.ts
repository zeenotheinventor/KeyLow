import type { SetType } from "@keylow/core/training";

export type SetTypeDialogProps = {
  open: boolean;
  /** Called for Escape, Close and a press on the dimmed page, which choose nothing. */
  onClose: () => void;
  exerciseName: string;
  /** The set's type now: its option is the checked one. */
  setType: SetType;
  /**
   * The number the set has among the exercise's working sets, or would have if it were one. It is drawn on
   * the Working option and in the line under the heading, so a warm-up still shows what it becomes.
   */
  setNumber: number;
  /** Called with the option that was pressed, the checked one included. The owner decides what to do and closes the dialog. */
  onChoose: (setType: SetType) => void;
  /** The mark that opened the dialog, which takes focus back when it closes. */
  returnFocusTo: Element | null;
};
