import type { EditorExercise, ExerciseField } from "./editorExercise";
import type { RoutineDraftDay } from "./routineDraft";

/** A day of the draft with what only the editor needs: a key that stays with it, and whether its body is showing. */
export type EditorDay = Omit<RoutineDraftDay, "exercises"> & {
  exercises: readonly EditorExercise[];
  /** Stays with the day while days come and go, so two days of one name keep their own state. */
  key: number;
  isOpen: boolean;
};

export type EditorState = Readonly<{
  name: string;
  days: readonly EditorDay[];
  /** The key the next day added takes. A removed day's key is never used again. */
  nextKey: number;
  /** The key the next exercise added takes, in any day. A removed exercise's key is never used again. */
  nextExerciseKey: number;
}>;

export type EditorAction =
  | { type: "renameRoutine"; name: string }
  | { type: "addDay" }
  | { type: "renameDay"; key: number; name: string }
  | { type: "setWeekday"; key: number; weekday: number | null }
  | { type: "removeDay"; key: number }
  | { type: "toggleDay"; key: number }
  | { type: "addExercise"; dayKey: number; exercise: { id: string; name: string } }
  | { type: "editExercise"; dayKey: number; key: number; field: ExerciseField; text: string }
  | { type: "removeExercise"; dayKey: number; key: number }
  | { type: "moveDay"; key: number; by: MoveDirection }
  | { type: "moveExercise"; dayKey: number; key: number; by: MoveDirection }
  | { type: "openDays"; keys: readonly number[] };

/** One place towards the start of the list (up), or towards its end (down). */
export type MoveDirection = "up" | "down";
