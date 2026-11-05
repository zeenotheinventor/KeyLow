import type { HistorySetCopy, SessionStatsCopy } from "@keylow/core/copy";
import type { HeatSet, SetType } from "@keylow/core/training";

/** A set of the session detail: the words of its row, with the key that keeps it in place. */
export type SessionDetailSet = {
  /** The logged set's id. */
  key: string;
  /** A warm-up's mark is drawn in the warning ink. */
  setType: SetType;
  /** The words of the row: `describeHistorySet`'s. */
  copy: HistorySetCopy;
};

/** An exercise of the session detail, with the sets logged for it. */
export type SessionDetailExercise = {
  exerciseId: string;
  name: string;
  /** The note beside the name: "Bodyweight", or null for none. */
  note: string | null;
  rows: readonly SessionDetailSet[];
};

/** What the Muscles trained card draws: the session's sets, and the heat read at its end. */
export type SessionDetailMuscles = {
  /** The sets of the session, and of the session alone: no fatigue from earlier days. */
  sets: readonly HeatSet[];
  /** The moment the figures' heat is read at, as an ISO timestamp with a zone. */
  at: string;
};

/** What the screen draws of a session that has loaded. */
export type SessionDetailContent = {
  /** The routine day's name, or Session. */
  title: string;
  /** "Tuesday 13 October · 18:00 to 18:51". */
  when: string;
  stats: SessionStatsCopy;
  musclesTrained: SessionDetailMuscles;
  /** In the order each was first logged. */
  exercises: readonly SessionDetailExercise[];
};

/** What the session detail has read. */
export type SessionDetailView =
  | { status: "loading" }
  /** `retry` is absent offline, where it would only join the wait. */
  | { status: "error"; retry: (() => void) | undefined }
  | { status: "notFound" }
  | { status: "ready"; content: SessionDetailContent };
