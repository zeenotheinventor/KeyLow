import type { ChosenExercise } from "../types";
import type { ExerciseDetail } from "@keylow/api-client";

/**
 * A saved exercise as the picker's rows hand one on: the detail's primary and secondary muscles, in the
 * order of the muscle list, and the assisting ones left out.
 */
export function chosenExerciseOf({ muscles, ...exercise }: ExerciseDetail): ChosenExercise {
  return {
    ...exercise,
    primary_muscles: muscles
      .filter(({ role }) => role === "primary")
      .map(({ muscle_id }) => muscle_id),
    secondary_muscles: muscles
      .filter(({ role }) => role === "secondary")
      .map(({ muscle_id }) => muscle_id),
  };
}
