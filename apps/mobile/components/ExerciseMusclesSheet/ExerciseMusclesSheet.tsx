import { useState } from "react";

import { BottomSheet } from "../ui";
import { ExerciseMusclesBody } from "./ExerciseMusclesBody";

import type { ExerciseMusclesSheetProps } from "./types";

/**
 * The "Muscles it works" sheet of the workout screen, as the board `session · exercise-muscles` draws it:
 * the exercise's name, the front and the back of the body coloured by role, and a row for each role with
 * its muscles and what a set counts for. The contents draw their own heading, so the sheet is named
 * for the exercise and carries no title. The muscles are read only while the sheet is open, and the
 * exercise stays on show, as it was last drawn, through the sheet's exit.
 */
export function ExerciseMusclesSheet({ exercise, onClose }: ExerciseMusclesSheetProps) {
  // The sheet takes its last length of time to leave, and the exercise must not vanish from it meanwhile.
  // Set while rendering on purpose, so the sheet opens on the exercise in the same render.
  const [lastExercise, setLastExercise] = useState(exercise);
  if (exercise !== null && exercise !== lastExercise) {
    setLastExercise(exercise);
  }
  const shown = exercise ?? lastExercise;

  return (
    <BottomSheet label={shown?.name} open={exercise !== null} onClose={onClose}>
      {shown === null ? null : (
        <ExerciseMusclesBody key={shown.id} exercise={shown} isOpen={exercise !== null} />
      )}
    </BottomSheet>
  );
}
