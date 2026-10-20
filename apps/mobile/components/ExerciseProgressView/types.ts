import type { ExerciseWeekRowProps } from "../ExerciseWeekRow";
import type { TrendRange } from "@keylow/core/training";

/** A week of the list under the graph: its Monday and what its row says. */
export type ExerciseWeekItem = Omit<ExerciseWeekRowProps, "selected" | "onPress"> & {
  /** The Monday the week starts on, `YYYY-MM-DD`. */
  week: string;
  /** Whether the week has a point on the chart to select. */
  hasPoint: boolean;
};

/** The chart's points and its words. */
export type ExerciseChartData = {
  points: readonly { week: string; value: number | null }[];
  /** `kg`, `lb`, or `reps` for an exercise with no load. */
  unit: string;
  /** What the chart shows, written above it: the exercise's name. */
  label: string;
  summary: string;
};

/** What the screen shows under the Range control: loading, failed, nothing trained in the range, or the chart and the weeks. */
export type ExerciseProgressBody =
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  /** No working set of the exercise in the range: the empty state, and no chart. */
  | { status: "empty" }
  | {
      status: "ready";
      chart: ExerciseChartData;
      /** The weeks of the range, newest first. */
      weeks: readonly ExerciseWeekItem[];
      /** Whether the exercise was trained in one week only, so the screen says a second week is needed for a change. */
      needsSecondWeek: boolean;
    };

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
