import {
  CONFIRM_DELETE_WORKOUT_BUTTONS,
  describeConfirmDeleteWorkoutQuestion,
} from "../../copy/assistantTrainingCards";

export type DeleteWorkoutQuestionInput = {
  /** The session's routine day name, or null for a session that follows no routine day. */
  dayName: string | null;
  /** The session's day, as `YYYY-MM-DD`. */
  localDate: string;
  /** The sets the app counts for the session, as its own delete question does. */
  setCount: number;
};

/** The two buttons under the question: "Delete workout" and "Keep it". */
export const confirmDeleteWorkoutButtons = () => ({
  confirmLabel: CONFIRM_DELETE_WORKOUT_BUTTONS.confirm,
  cancelLabel: CONFIRM_DELETE_WORKOUT_BUTTONS.cancel,
});

/** "Delete your Legs workout from Thursday 8 October? It has 16 sets. They leave your history and your weekly numbers." */
export const confirmDeleteWorkoutQuestion = ({
  dayName,
  localDate,
  setCount,
}: DeleteWorkoutQuestionInput): string =>
  describeConfirmDeleteWorkoutQuestion(dayName, localDate, setCount);
