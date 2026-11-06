import type { ProgressChange } from "@keylow/core/copy";
import type { TrendRange } from "@keylow/core/training";

/** A week of the list under the graph: its Monday and what its row says. */
export type ExerciseWeekItem = {
  /** The Monday the week starts on, `YYYY-MM-DD`. */
  week: string;
  /** Whether the week has a point on the chart to select. */
  hasPoint: boolean;
  /** The Monday the week starts on, such as "Mon 14 Sep". */
  weekLabel: string;
  /** The value with its reps, such as "62.5 kg for 6 reps". Null for a skipped week, which reads "Not trained". */
  value: string | null;
  /** The change in words, with the sign, and which way it went. */
  change: ProgressChange<"up" | "down" | null> | null;
  /** The row said in full, for a screen reader. */
  accessibleName: string;
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

/** What a screen shows under the Range control: loading, failed, nothing trained in the range, or the chart and the weeks. */
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

/** What `useExerciseProgress` gives a screen apart from its range and selection. */
export type ExerciseProgress = {
  /** The exercise's name once it is read, or a plain title until then. */
  title: string;
  body: ExerciseProgressBody;
  /**
   * The range the rows on show were read for. It is the range asked for unless a new range is still being
   * read, when the rows of the one before stay on show. Null while nothing has been read.
   */
  shownRange: TrendRange | null;
  /** When the rows on show were read, or null while nothing has been read. */
  readAt: Date | null;
  /**
   * Whether the screen has nothing to show and nothing to wait for: offline, with nothing read, a failed
   * read, or a range whose rows are not the ones on show. Always false when `isOnline` is not given.
   */
  notRead: boolean;
  /** The profile's time zone, in which `readAt` is told as a clock time. UTC until it is read. */
  timeZone: string;
};
