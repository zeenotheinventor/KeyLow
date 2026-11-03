import { describeCardTotalKcal } from "./entryCardEntry";
import {
  describeDayCopiedSub,
  describeDayCopiedTitle,
  describeDayCopiedUndone,
} from "../../copy/assistantDayCards";

import type { AssistantCardDraft, CardEntry } from "./entryCardEntry";

type DayCopied = {
  /** The day copied from, and the day copied onto, as `YYYY-MM-DD`. */
  from: string;
  to: string;
  /** The person's today, which decides whether a day is called "yesterday" or "today". */
  today: string;
  /** The rows the copy inserted, as the database holds them, so the total is the copies' own snapshots. */
  entries: readonly CardEntry[];
};

/**
 * The card after a `copy_day`: "Copied 8 entries from yesterday", the two days and the copied kcal under
 * it, no rows, and the line shown once Undo has run.
 */
export function buildDayCopiedCard({ from, to, today, entries }: DayCopied): AssistantCardDraft {
  return {
    kind: "day_copied",
    title: describeDayCopiedTitle(from, today, entries.length),
    sub: describeDayCopiedSub(from, to, today, describeCardTotalKcal(entries)),
    rows: [],
    totalText: null,
    note: null,
    link: null,
    undo: "available",
    undoneSub: describeDayCopiedUndone(entries.length, to, today),
  };
}
