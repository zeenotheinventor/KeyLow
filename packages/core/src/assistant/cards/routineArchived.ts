import {
  ROUTINE_ARCHIVED_SUB,
  describeRoutineArchivedTitle,
  describeRoutineArchivedUndone,
} from "../../copy/assistantTrainingCards";

import type { AssistantCardDraft } from "./entryCardEntry";

/** The card after an `archive_routine`: "Archived routine Upper Lower", with Undo that restores it. */
export function buildRoutineArchivedCard({ name }: { name: string }): AssistantCardDraft {
  return {
    kind: "routine_archived",
    title: describeRoutineArchivedTitle(name),
    sub: ROUTINE_ARCHIVED_SUB,
    rows: [],
    totalText: null,
    note: null,
    link: null,
    undo: "available",
    undoneSub: describeRoutineArchivedUndone(name),
  };
}
