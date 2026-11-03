import {
  TARGETS_CHANGED_NOTE_PROGRAMME_ENDED_WITHOUT_UNDO,
  TARGETS_CHANGED_NOTE_WITHOUT_UNDO,
  describeTargetsChangedNote,
  describeTargetsChangedSub,
  describeTargetsChangedTitle,
  describeTargetsChangedUndone,
} from "../../copy/assistantTargetCards";

import type { AssistantCardDraft } from "./entryCardEntry";

export type TargetsChangedCardChange = {
  /** The calorie target now. */
  kcal: number;
  /** The calorie target before, or null when none was set. */
  previousKcal: number | null;
  /** True when saving the targets ended a programme. Only then can Undo put the old targets back. */
  endedProgramme: boolean;
  /**
   * False when the write left nothing Undo could check (the change time could not be read), so the card
   * turns Undo off as `log_entry`'s does. Defaults to `endedProgramme`.
   */
  undoable?: boolean;
};

/**
 * The card after an `update_targets`: "Changed your calorie target to 2,000 kcal". The sub names the
 * programme only when one ended. With no programme the previous numbers are stored nowhere, so the card
 * has no Undo (KEY-662 review, 2026-10-26).
 */
export function buildTargetsChangedCard({
  kcal,
  previousKcal,
  endedProgramme,
  undoable = endedProgramme,
}: TargetsChangedCardChange): AssistantCardDraft {
  const canUndo = endedProgramme && undoable;
  return {
    kind: "targets_changed",
    title: describeTargetsChangedTitle(kcal),
    sub: previousKcal === null ? null : describeTargetsChangedSub(previousKcal, endedProgramme),
    rows: [],
    totalText: null,
    note: canUndo
      ? describeTargetsChangedNote(previousKcal)
      : endedProgramme
        ? TARGETS_CHANGED_NOTE_PROGRAMME_ENDED_WITHOUT_UNDO
        : TARGETS_CHANGED_NOTE_WITHOUT_UNDO,
    link: null,
    undo: canUndo ? "available" : "unavailable",
    undoneSub: canUndo ? describeTargetsChangedUndone(previousKcal) : null,
  };
}
