import type { ExerciseNames, RoutineDraft } from "@keylow/core/training";

export type RoutineEditorProps = {
  /** The routine to edit, as a draft. Leave it out to create a routine, which starts with no name and no days. */
  initialDraft?: RoutineDraft | undefined;
  /** The names of the draft's exercises, by exercise id, for the rows that show them. */
  exerciseNames?: ExerciseNames | undefined;
  /** The id of the routine being edited, which Save replaces. Leave it out to create a routine. */
  routineId?: string | undefined;
  /** Whether the stored routine is the active one, which cannot be archived. Read from the routine as it is now. */
  isActive?: boolean | undefined;
  /** Whether the stored routine is archived. Archive routine is not drawn for one. */
  isArchived?: boolean | undefined;
};
