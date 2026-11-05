import type { MuscleSheetCopy } from "@keylow/core/copy";
import type { MuscleDetail } from "@keylow/core/training";

export type MuscleSheetContentProps = {
  /** The sheet's words, from `describeMuscleSheet`. */
  copy: MuscleSheetCopy;
  /** The detail the words were written from. */
  detail: MuscleDetail;
  /** Opens the routine editor from the Not trained sheet, which draws its button only when this is given. */
  onEditRoutine?: (() => void) | undefined;
};
