import type { SetRowCopy } from "@keylow/core/copy";
import type { SetRowState, SetType } from "@keylow/core/training";

/** Opens the set entry for a set still to do: the name of the cells as a button, and what pressing them does. */
export type SetRowEdit = {
  name: string;
  onPress: () => void;
};

export type SetRowProps = {
  /** Done is logged, next is the set to log now, to do is a planned set still to come. */
  state: SetRowState;
  /** A warm-up's mark is drawn in the warning ink. */
  setType: SetType;
  /** The cells of the row and the accessible name of its check: `describeSetRow`'s. */
  copy: SetRowCopy;
  /** A set still to do has its load, reps and RIR cells as one button that opens the set entry. A row without it only displays. */
  edit?: SetRowEdit | undefined;
};
