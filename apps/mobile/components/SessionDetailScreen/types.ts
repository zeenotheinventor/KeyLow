import type { ReadOnlyExerciseCardProps } from "../ExerciseCard";
import type { MusclesTrainedCardProps } from "../MusclesTrainedCard";
import type { SessionOrigin, SessionStatsCopy } from "@keylow/core/copy";

export type SessionDetailScreenProps = {
  /** The session's id, from the address. Undefined or one that is not a session of the person reads as not found. */
  id: string | undefined;
  /** The screen the session was opened from, which the Back control is named for. */
  origin: SessionOrigin;
  /** The header's Back: goes back to the screen before this one. */
  onBack: () => void;
  /** Goes to the history list: the way out of a session that is not found. */
  onOpenHistory: () => void;
};

/** What the screen draws of a session that has loaded. */
export type SessionDetailContent = {
  /** The routine day's name, or Session. */
  title: string;
  /** "Tuesday 13 October · 18:00 to 18:51". */
  when: string;
  stats: SessionStatsCopy;
  /** What the Muscles trained card draws: the session's sets, and the heat read at its end. */
  musclesTrained: MusclesTrainedCardProps;
  /** In the order each was first logged. */
  exercises: readonly (ReadOnlyExerciseCardProps & { exerciseId: string })[];
};

/** What the session detail has read. */
export type SessionDetailView =
  | { status: "loading" }
  /** `retry` is absent offline, where it would only join the wait. */
  | { status: "error"; retry: (() => void) | undefined }
  | { status: "notFound" }
  | { status: "ready"; content: SessionDetailContent };
