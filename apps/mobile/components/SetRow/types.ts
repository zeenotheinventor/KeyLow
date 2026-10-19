import type { SetRowCopy } from "@keylow/core/copy";
import type { SetRowState, SetType } from "@keylow/core/training";

export type SetRowProps = {
  /** Done is logged, next is the set to log now, to do is a planned set still to come. */
  state: SetRowState;
  /** A warm-up's mark is drawn in the warning ink. */
  setType: SetType;
  /** The cells of the row and the accessible name of its check: `describeSetRow`'s. */
  copy: SetRowCopy;
};
