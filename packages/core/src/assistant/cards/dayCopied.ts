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
  /** How many entries the copy inserted, which words the card whatever could be read back. */
  count: number;
  /** The rows read back, so the total is the copies' own snapshots. Fewer than `count` leaves the total off. */
  entries: readonly CardEntry[];
};

/**
 * The card after a `copy_day`: "Copied 8 entries from yesterday", the two days and the copied kcal under
 * it, no rows, and the line shown once Undo has run.
 */
export function buildDayCopiedCard({
  from,
  to,
  today,
  count,
  entries,
}: DayCopied): AssistantCardDraft {
  return {
    kind: "day_copied",
    title: describeDayCopiedTitle(from, today, count),
    sub: describeDayCopiedSub(
      from,
      to,
      today,
      entries.length === count ? describeCardTotalKcal(entries) : null,
    ),
    rows: [],
    totalText: null,
    note: null,
    link: null,
    undo: "available",
    undoneSub: describeDayCopiedUndone(count, to, today),
  };
}
