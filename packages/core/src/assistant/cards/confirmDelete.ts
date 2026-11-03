import { describeStoredName, sharedClockTime } from "./entryCardEntry";
import {
  CONFIRM_DELETE_BUTTONS,
  describeConfirmDeleteQuestion,
} from "../../copy/assistantEntryCards";

import type { CardEntry } from "./entryCardEntry";

/** The two buttons under the model's own question, and a formatter for that question the turn loop may use. */
export const confirmDeleteButtons = (count: number) => ({
  confirmLabel: CONFIRM_DELETE_BUTTONS.confirm(count),
  cancelLabel: CONFIRM_DELETE_BUTTONS.cancel,
});

/** "Delete 3 entries at 13:00 today? chicken and rice, greek yoghurt and apple." `dayWord` is "today", "yesterday" or the date. */
export const confirmDeleteQuestion = (entries: readonly CardEntry[], dayWord: string): string =>
  describeConfirmDeleteQuestion(
    entries.length,
    sharedClockTime(entries),
    dayWord,
    entries.map(describeStoredName),
  );
