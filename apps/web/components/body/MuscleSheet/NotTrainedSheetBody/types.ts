import type { NotTrainedMuscleSheetCopy } from "@keylow/core/copy";
import type { MuscleDetail } from "@keylow/core/training";

export type NotTrainedSheetBodyProps = {
  /** The sheet's words, from `describeMuscleSheet`. */
  copy: NotTrainedMuscleSheetCopy;
  /** The detail the words were written from, which the heat swatch is drawn from. */
  detail: MuscleDetail;
};
