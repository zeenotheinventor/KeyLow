import { cardRowOf, describeCardName, sharedClockTime } from "./entryCardEntry";
import { UPDATED_CARD } from "../../copy/assistantEntryCards";

import type { CardEntry, AssistantCardDraft } from "./entryCardEntry";

/** The card after an `update_entry`, which has no Undo in M8 (ADR 0006): the changed rows and a note. */
export function buildUpdatedCard(entries: readonly CardEntry[]): AssistantCardDraft {
  return {
    kind: "updated",
    title: UPDATED_CARD.title(entries.map(describeCardName), sharedClockTime(entries)),
    sub: null,
    rows: entries.map(cardRowOf),
    totalText: null,
    note: UPDATED_CARD.note,
    link: null,
    undo: "unavailable",
    undoneSub: null,
  };
}
