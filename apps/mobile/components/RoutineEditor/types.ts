import type { RoutineDraft, RoutineDraftDay } from "@keylow/core/training";

export type RoutineEditorProps = {
  /** The routine to edit, as a draft. Leave it out to create a routine, which starts with no name and no days. */
  initialDraft?: RoutineDraft | undefined;
};

/** A day of the draft with what only the editor needs: a key that stays with it, and whether its body is showing. */
export type EditorDay = RoutineDraftDay & {
  /** Stays with the day while days come and go, so two days of one name keep their own state. */
  key: number;
  isOpen: boolean;
};

export type EditorState = Readonly<{
  name: string;
  days: readonly EditorDay[];
  /** The key the next day added takes. A removed day's key is never used again. */
  nextKey: number;
}>;

export type EditorAction =
  | { type: "renameRoutine"; name: string }
  | { type: "addDay" }
  | { type: "renameDay"; key: number; name: string }
  | { type: "setWeekday"; key: number; weekday: number | null }
  | { type: "removeDay"; key: number }
  | { type: "toggleDay"; key: number };

/** The sheet over the editor, and the day it is about. The name is kept as it was when the sheet opened, so the sheet's title holds while it slides away. */
export type OpenSheet = { kind: "weekday" | "menu"; dayKey: number; dayName: string };
