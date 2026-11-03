import { describeStoredName, sharedClockTime } from "./entryCardEntry";
import {
  describeDeletedSub,
  describeDeletedTitle,
  describeDeletedUndone,
} from "../../copy/assistantEntryCards";

import type { CardEntry, AssistantCardDraft } from "./entryCardEntry";

/** The card after a `delete_entry`: "3 entries deleted", the names and the time, with Undo. */
export function buildDeletedCard(entries: readonly CardEntry[]): AssistantCardDraft {
  const clockTime = sharedClockTime(entries);
  return {
    kind: "deleted",
    title: describeDeletedTitle(entries.length),
    sub: describeDeletedSub(entries.map(describeStoredName), clockTime),
    rows: [],
    totalText: null,
    note: null,
    link: null,
    undo: "available",
    undoneSub: describeDeletedUndone(entries.length, clockTime),
  };
}
