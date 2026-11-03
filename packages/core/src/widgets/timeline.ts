import { MILLISECONDS_PER_MINUTE, TIMELINE_STEP_MINUTES } from "./constants";
import { muscleStatesAt, targetOf } from "./day";
import { WidgetError } from "./error";
import { addCalendarDays } from "../dates/calendarDay";
import { instantAtLocalTime } from "../dates/instantAtLocalTime";
import { toLocalDate } from "../dates/toLocalDate";
import { warmestMuscles } from "../training/bodyMapValues";

import type { WidgetSnapshot } from "./snapshot";
import type { WarmMuscle } from "../training/bodyMapValues";

/** One moment the widget should redraw at, and what is true then that the snapshot alone does not say. */
export type TimelineEntry = Readonly<{
  /** When to redraw, an ISO timestamp in UTC. */
  at: string;
  /** "midnight" is the start of a new day, "heat" is a step of the heat decay. */
  reason: "heat" | "midnight";
  /** The local day at `at`. */
  localDate: string;
  /** That day's calorie target for its weekday, null when no target is set. */
  targetKcal: number | null;
  /** The warmest muscles then, by the heat model. */
  warmest: readonly WarmMuscle[];
}>;

/**
 * What to show later: an entry every `TIMELINE_STEP_MINUTES` after `now` while the heat decays, up to the
 * next local midnight, and one entry at that midnight, a new day with that weekday's target. Every entry
 * calls the heat model's pure functions with its own time, so nothing here decays a stored value.
 * Throws a `WidgetError` when `now` is not a valid date.
 */
export const widgetTimeline = (snapshot: WidgetSnapshot, now: Date): TimelineEntry[] => {
  if (Number.isNaN(now.getTime())) {
    throw new WidgetError("timeline", "invalid_now");
  }
  const today = toLocalDate(now, snapshot.timeZone);
  const tomorrow = addCalendarDays(today, 1);
  const midnight = instantAtLocalTime(tomorrow, 0, 0, snapshot.timeZone);
  const entryAt = (
    at: Date,
    reason: TimelineEntry["reason"],
    localDate: string,
  ): TimelineEntry => ({
    at: at.toISOString(),
    reason,
    localDate,
    targetKcal: targetOf(snapshot, localDate),
    warmest: warmestMuscles(muscleStatesAt(snapshot, at)),
  });
  const step = TIMELINE_STEP_MINUTES * MILLISECONDS_PER_MINUTE;
  const entries: TimelineEntry[] = [];
  for (let at = now.getTime() + step; at < midnight.getTime(); at += step) {
    entries.push(entryAt(new Date(at), "heat", today));
  }

  return [...entries, entryAt(midnight, "midnight", tomorrow)];
};
