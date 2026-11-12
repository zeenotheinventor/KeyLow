import {
  CONFIRM_ARCHIVE_EXERCISE_BUTTONS,
  describeConfirmArchiveExerciseQuestion,
} from "../../copy/assistantTrainingCards";

/** The two buttons under the model's own question, and a formatter for that question the tool may use. */
export const confirmArchiveExerciseButtons = () => ({
  confirmLabel: CONFIRM_ARCHIVE_EXERCISE_BUTTONS.confirm,
  cancelLabel: CONFIRM_ARCHIVE_EXERCISE_BUTTONS.cancel,
});

/** "Archive Cable crunch? It leaves your exercise list. Sets you logged with it stay in your history." */
export const confirmArchiveExerciseQuestion = (exerciseName: string): string =>
  describeConfirmArchiveExerciseQuestion(exerciseName);
