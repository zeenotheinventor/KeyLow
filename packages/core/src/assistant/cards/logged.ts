import { cardRowOf, describeCardName, describeCardTotal, sharedClockTime } from "./entryCardEntry";
import { describeLoggedTitle, describeLoggedUndone } from "../../copy/assistantEntryCards";

import type { CardEntry, AssistantCardDraft } from "./entryCardEntry";

/**
 * The card after a `log_entry`, worded from the rows it wrote: "Logged 2 eggs and toast at 08:10", a row
 * for each entry, the total of the entries and the line shown once Undo has run.
 */
export function buildLoggedCard(entries: readonly CardEntry[]): AssistantCardDraft {
  const names = entries.map(describeCardName);
  const clockTime = sharedClockTime(entries);
  return {
    kind: "logged",
    title: describeLoggedTitle(names, clockTime),
    sub: null,
    rows: entries.map(cardRowOf),
    totalText: describeCardTotal(entries),
    note: null,
    link: null,
    undo: "available",
    undoneSub: describeLoggedUndone(names, clockTime),
  };
}
