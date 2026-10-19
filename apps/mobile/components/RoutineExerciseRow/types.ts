import type { ExerciseField } from "../RoutineEditor";

export type RoutineExerciseRowProps = {
  name: string;
  /** The sets, as typed. */
  setsText: string;
  /** The reps, as typed: one number, or a range such as "8 to 12". */
  repsText: string;
  /** The RIR, as typed. Empty means no target. */
  rirText: string;
  onChangeField: (field: ExerciseField, text: string) => void;
  onRemove: () => void;
};
