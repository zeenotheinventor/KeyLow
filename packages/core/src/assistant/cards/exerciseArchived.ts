import {
  EXERCISE_ARCHIVED_SUB,
  describeExerciseArchivedTitle,
  describeExerciseArchivedUndone,
} from "../../copy/assistantTrainingCards";

import type { AssistantCardDraft } from "./entryCardEntry";

/**
 * The card after an `archive_custom_exercise`: "Archived exercise Cable crunch", with Undo that brings it
 * back. It has no link, because no screen opens a custom exercise.
 */
export function buildExerciseArchivedCard({ name }: { name: string }): AssistantCardDraft {
  return {
    kind: "exercise_archived",
    title: describeExerciseArchivedTitle(name),
    sub: EXERCISE_ARCHIVED_SUB,
    rows: [],
    totalText: null,
    note: null,
    link: null,
    undo: "available",
    undoneSub: describeExerciseArchivedUndone(name),
  };
}
