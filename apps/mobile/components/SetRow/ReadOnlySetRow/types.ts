import type { HistorySetCopy } from "@keylow/core/copy";
import type { SetType } from "@keylow/core/training";

export type ReadOnlySetRowProps = {
  /** A warm-up's mark is drawn in the warning ink. */
  setType: SetType;
  /** The words of the row: `describeHistorySet`'s. */
  copy: HistorySetCopy;
  /** A set beyond what the plan targets for its exercise is tinted with the accent fill. */
  isNotInPlan: boolean;
  /**
   * What pressing the row does: opens the edit for the set. With it the row is a button, named as the copy
   * names it, with a chevron. Without it the row only displays, named without the edit, and has no chevron.
   */
  onPress?: (() => void) | undefined;
};
