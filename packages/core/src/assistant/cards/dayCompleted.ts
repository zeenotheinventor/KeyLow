import {
  describeDayCompletedTitle,
  describeDayCompletedUndone,
  describeLongDate,
} from "../../copy/assistantDayCards";

import type { AssistantCardDraft } from "./entryCardEntry";

type DayCompleted = {
  /** The diary day, `YYYY-MM-DD`. */
  localDate: string;
  /** What the day was set to. */
  complete: boolean;
};

/**
 * The card after a `set_day_complete`: the Diary's own "Day complete" with the day under it, and the
 * opposite state as the line shown once Undo has run. No board draws this card.
 */
export function buildDayCompletedCard({ localDate, complete }: DayCompleted): AssistantCardDraft {
  return {
    kind: "day_completed",
    title: describeDayCompletedTitle(complete),
    sub: describeLongDate(localDate),
    rows: [],
    totalText: null,
    note: null,
    link: null,
    undo: "available",
    undoneSub: describeDayCompletedUndone(complete),
  };
}
