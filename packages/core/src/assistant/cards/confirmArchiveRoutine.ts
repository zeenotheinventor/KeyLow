import {
  CONFIRM_ARCHIVE_ROUTINE_BUTTONS,
  describeConfirmArchiveRoutineQuestion,
} from "../../copy/assistantTrainingCards";

/** The two buttons under the model's own question: "Archive routine" and "Keep it". */
export const confirmArchiveRoutineButtons = () => ({
  confirmLabel: CONFIRM_ARCHIVE_ROUTINE_BUTTONS.confirm,
  cancelLabel: CONFIRM_ARCHIVE_ROUTINE_BUTTONS.cancel,
});

/** "Archive Upper Lower? It leaves your routine list. Sessions you logged with it stay in your history." */
export const confirmArchiveRoutineQuestion = (routineName: string): string =>
  describeConfirmArchiveRoutineQuestion(routineName);
