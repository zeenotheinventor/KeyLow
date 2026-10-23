import type { ReadOnlySetRowProps } from "./ReadOnlySetRow";
import type { SetRowCopy } from "@keylow/core/copy";
import type { SetRowState, SetType } from "@keylow/core/training";

/** Opens the set entry for a set still to do: the name of the cells as a button, and what pressing them does. */
export type SetRowEdit = {
  name: string;
  onPress: () => void;
};

/** Opens the set types sheet for a logged set: the name of its mark as a button, and what pressing it does. */
export type SetRowTypeEdit = {
  name: string;
  onPress: () => void;
};

export type ActiveSetRowProps = {
  /** The row of the session in progress. This is the default. */
  variant?: "active" | undefined;
  /** Done is logged, next is the set to log now, to do is a planned set still to come. */
  state: SetRowState;
  /** A warm-up's mark is drawn in the warning ink. */
  setType: SetType;
  /** The cells of the row and the accessible name of its check: `describeSetRow`'s. */
  copy: SetRowCopy;
  /** A set still to do has its load, reps and RIR cells as one button that opens the set entry. A row without it only displays. */
  edit?: SetRowEdit | undefined;
  /**
   * A logged set has its mark as a button that opens the set types sheet. The mark of a row to do, and of a
   * row without this, only displays.
   */
  typeEdit?: SetRowTypeEdit | undefined;
  /**
   * What pressing the check does: logs the row, or removes it when it is done. With it the check is a
   * button, named as the copy names it. Without it the check only displays.
   */
  onCheck?: (() => void) | undefined;
};

/**
 * A set of the session in progress, or with `variant="readOnly"` a set of a logged session as the session
 * detail draws it: what was done, with no check, and a press only when it is given what it does.
 */
export type SetRowProps = ActiveSetRowProps | (ReadOnlySetRowProps & { variant: "readOnly" });
