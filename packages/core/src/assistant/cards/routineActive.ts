import {
  OPEN_IN_ROUTINE_EDITOR,
  ROUTINE_CLEARED_TITLE,
  describeRoutineActiveChangeDetail,
  describeRoutineActiveSub,
  describeRoutineActiveTitle,
  describeRoutineActiveUndone,
  describeRoutineClearedSub,
} from "../../copy/assistantTrainingCards";

import type { AssistantCardDraft } from "./entryCardEntry";

export type RoutineActiveCardChange = {
  routineId: string;
  name: string;
  /** The name of the routine that was active, or null when none was. */
  previousName: string | null;
};

/**
 * The card after a `set_active_routine`: "Push Pull Legs is your active routine", what was active before and a
 * link into the routine editor. Undo makes the one before active again, or clears it when none was.
 */
export function buildRoutineActiveCard({
  routineId,
  name,
  previousName,
}: RoutineActiveCardChange): AssistantCardDraft {
  return {
    kind: "routine_active",
    title: describeRoutineActiveTitle(name),
    sub: describeRoutineActiveSub(previousName),
    rows: [],
    ...(previousName === null
      ? {}
      : { changeDetail: describeRoutineActiveChangeDetail(previousName) }),
    totalText: null,
    note: null,
    link: { label: OPEN_IN_ROUTINE_EDITOR, target: { screen: "routine_editor", routineId } },
    undo: "available",
    undoneSub: describeRoutineActiveUndone(previousName),
  };
}

/** The card after a `set_active_routine` with null: "No routine is active", no link, and Undo makes the old one active again. */
export function buildRoutineClearedCard({
  previousName,
}: {
  previousName: string;
}): AssistantCardDraft {
  return {
    kind: "routine_active",
    title: ROUTINE_CLEARED_TITLE,
    sub: describeRoutineClearedSub(previousName),
    rows: [],
    changeDetail: describeRoutineActiveChangeDetail(previousName),
    totalText: null,
    note: null,
    link: null,
    undo: "available",
    undoneSub: describeRoutineActiveUndone(previousName),
  };
}
