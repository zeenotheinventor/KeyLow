import type { NotTargetedMuscleSheetCopy } from "@keylow/core/copy";
import type { MuscleDetail } from "@keylow/core/training";

export type NotTargetedSheetBodyProps = {
  /** The sheet's words, from `describeMuscleSheet`. */
  copy: NotTargetedMuscleSheetCopy;
  /** The detail the words were written from, which the heat swatch is drawn from. */
  detail: MuscleDetail;
};
