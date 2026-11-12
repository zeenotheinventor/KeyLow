import type { ProgressChange } from "@keylow/core/copy";

/** An exercise of a routine day: its id, which its graph is opened by, and what its row says. */
export type RoutineProgressExercise = {
  exerciseId: string;
  /** The exercise's name. */
  name: string;
  /** The line under the name, already written by core: this week's value, or the last one when this week is a gap. */
  line: string;
  /** How this week moved, or null when it did not, or when the exercise was not trained this week. */
  change: ProgressChange | null;
  /** The row said in full, for a screen reader. */
  accessibleName: string;
  /** The last weeks for the sparkline, oldest first, a skipped week as `null`. */
  points: readonly (number | null)[];
};

/** A routine day with the progress of its exercises, in the routine's order. */
export type RoutineProgressDayItem = {
  id: string;
  name: string;
  exercises: readonly RoutineProgressExercise[];
};

/**
 * What the Progress section shows: its routine days, or while they are read a loading state, or a failed
 * one with its retry.
 */
export type RoutineProgressState =
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | { status: "ready"; days: readonly RoutineProgressDayItem[] };

/** What `useRoutineProgress` gives a screen. */
export type RoutineProgress = {
  state: RoutineProgressState;
  /**
   * Whether the section has nothing to show and nothing to wait for: offline, with the reads not all held.
   * Such a read waits for a connection that may not come, so a screen does not draw a skeleton or a retry
   * for it. Always false when `isOnline` is not given.
   */
  notRead: boolean;
};
