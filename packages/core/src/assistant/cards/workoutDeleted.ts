import {
  describeWorkoutDeletedChangeDetail,
  describeWorkoutDeletedSub,
  describeWorkoutDeletedTitle,
  describeWorkoutDeletedUndone,
} from "../../copy/assistantTrainingCards";

import type { DeleteWorkoutQuestionInput } from "./confirmDeleteWorkout";
import type { AssistantCardDraft } from "./entryCardEntry";

/**
 * The card after a `delete_workout`: "Deleted workout Legs", the day and its set count under it, no link
 * (the workout is gone from the history), and Undo that brings it back. The words come from the session as
 * the tool read it before the delete, and nothing the model sent.
 */
export function buildWorkoutDeletedCard({
  dayName,
  localDate,
  setCount,
}: DeleteWorkoutQuestionInput): AssistantCardDraft {
  return {
    kind: "workout_deleted",
    title: describeWorkoutDeletedTitle(dayName),
    sub: describeWorkoutDeletedSub(localDate, setCount),
    rows: [],
    changeDetail: describeWorkoutDeletedChangeDetail(localDate, setCount),
    totalText: null,
    note: null,
    link: null,
    undo: "available",
    undoneSub: describeWorkoutDeletedUndone(dayName, localDate),
  };
}
