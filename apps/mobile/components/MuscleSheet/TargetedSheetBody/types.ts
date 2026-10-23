import type { TargetedMuscleSheetCopy } from "@keylow/core/copy";
import type { MuscleDetail } from "@keylow/core/training";

export type TargetedSheetBodyProps = {
  /** The sheet's words, from `describeMuscleSheet`. */
  copy: TargetedMuscleSheetCopy;
  /** The detail the words were written from, which the heat swatch and the bar are drawn from. */
  detail: MuscleDetail;
};
