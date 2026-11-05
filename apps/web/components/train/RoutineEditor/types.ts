import type { ExerciseNames, RoutineDraft } from "@keylow/core/training";

export type RoutineEditorProps = {
  /** The routine to edit, as a draft. Leave it out to create a routine, which starts with no name and no days. */
  initialDraft?: RoutineDraft | undefined;
  /** The names of the draft's exercises, by exercise id, for the rows that show them. */
  exerciseNames?: ExerciseNames | undefined;
  /** The id of the routine being edited, which Save replaces. Leave it out to create a routine. */
  routineId?: string | undefined;
};
