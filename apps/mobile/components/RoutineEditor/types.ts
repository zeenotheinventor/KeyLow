import type { ExerciseNames, RoutineDraft } from "@keylow/core/training";

export type RoutineEditorProps = {
  /** The routine to edit, as a draft. Leave it out to create a routine, which starts with no name and no days. */
  initialDraft?: RoutineDraft | undefined;
  /** The names of the draft's exercises, by exercise id, for the rows that show them. */
  exerciseNames?: ExerciseNames | undefined;
  /** The id of the routine being edited, which Save replaces. Leave it out to create a routine. */
  routineId?: string | undefined;
  /** Whether the routine being edited is the active one, which cannot be archived. */
  isActive?: boolean | undefined;
  /** Whether the routine being edited is archived, which has nothing left to archive. */
  isArchived?: boolean | undefined;
};

/** The sheet over the editor, and the day it is about. The name is kept as it was when the sheet opened, so the sheet's title holds while it slides away. */
export type OpenSheet = {
  kind: "weekday" | "menu" | "exercise" | "exerciseMenu";
  dayKey: number;
  dayName: string;
  exerciseKey?: number | undefined;
  exerciseName?: string | undefined;
};
