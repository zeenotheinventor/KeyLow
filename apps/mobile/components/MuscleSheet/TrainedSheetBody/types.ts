import type { TrainedMuscleSheetCopy } from "@keylow/core/copy";
import type { MuscleDetail } from "@keylow/core/training";

export type TrainedSheetBodyProps = {
  /** The sheet's words, from `describeMuscleSheet`. */
  copy: TrainedMuscleSheetCopy;
  /** The detail the words were written from, which the heat swatch and the bar are drawn from. */
  detail: MuscleDetail;
};
