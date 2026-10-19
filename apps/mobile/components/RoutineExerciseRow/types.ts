import type { ExerciseField, ExerciseMarks } from "../RoutineEditor";
import type { RefCallback } from "react";
import type { View } from "react-native";

export type RoutineExerciseRowProps = {
  name: string;
  /** The sets, as typed. */
  setsText: string;
  /** The reps, as typed: one number, or a range such as "8 to 12". */
  repsText: string;
  /** The RIR, as typed. Empty means no target. */
  rirText: string;
  /** Lets the screen that scrolls to a problem find the row. */
  rowRef?: RefCallback<View> | undefined;
  /** What is wrong with the row's fields, or undefined when nothing is. */
  marks?: ExerciseMarks | undefined;
  onChangeField: (field: ExerciseField, text: string) => void;
  /** Opens the exercise's menu: Move up, Move down and Remove. */
  onOpenMenu: () => void;
};
