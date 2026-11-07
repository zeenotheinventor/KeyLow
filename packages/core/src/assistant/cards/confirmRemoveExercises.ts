import {
  CONFIRM_REMOVE_EXERCISES_BUTTONS,
  describeConfirmRemoveExercisesQuestion,
} from "../../copy/assistantTrainingCards";

/** The two buttons under the model's own question, and a formatter for that question the tool may use. */
export const confirmRemoveExercisesButtons = (count: number) => ({
  confirmLabel: CONFIRM_REMOVE_EXERCISES_BUTTONS.confirm(count),
  cancelLabel: CONFIRM_REMOVE_EXERCISES_BUTTONS.cancel,
});

/**
 * "Remove 2 exercises from Legs in Push Pull Legs? Leg press and Seated leg curl. Sessions you logged keep
 * them." `dayName` is null when the exercises are in more than one day.
 */
export const confirmRemoveExercisesQuestion = ({
  exerciseNames,
  dayName,
  routineName,
}: {
  exerciseNames: readonly string[];
  dayName: string | null;
  routineName: string;
}): string => describeConfirmRemoveExercisesQuestion(exerciseNames, dayName, routineName);
