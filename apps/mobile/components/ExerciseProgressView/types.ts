import type { ExerciseProgressBody } from "@keylow/api-client";
import type { TrendRange } from "@keylow/core/training";

export type ExerciseProgressViewProps = {
  /** The exercise's name, or a plain title while it is not known. */
  title: string;
  onBack: () => void;
  range: TrendRange;
  onChangeRange: (range: TrendRange) => void;
  /** The week the chart has selected, `YYYY-MM-DD`. The latest week stands in while none is. */
  selectedWeek: string | undefined;
  onSelectWeek: (week: string) => void;
} & ExerciseProgressBody;
