import { addCalendarDays, daysSinceMonday } from "../../dates";

import type { WeekRecord } from "./types";

export type WeeklyWalk = {
  current: number;
  longest: number;
  thisWeek: "complete" | "at_risk";
  /** Each week that has ended and counted, with how many counted weeks in a row it made. */
  endedRuns: { weekStart: string; length: number }[];
};

const DAYS_PER_WEEK = 7;

/** A week counts when it reaches its required count, and never when nothing was done in it. */
function weekCounts(record: WeekRecord | undefined): boolean {
  return record !== undefined && record.achieved >= Math.max(record.required, 1);
}

/**
 * Walks Monday to Sunday weeks from the first one that counted to the week `today` is in. A week
 * missing from `weeks` is a week with nothing done. The current week is at risk until Sunday ends,
 * so it adds to the streak when it counts and never breaks it. Pure: no clock is read.
 */
export function walkWeeklyStreak(weeks: WeekRecord[], today: string): WeeklyWalk {
  const recordByWeek = new Map(weeks.map((record) => [record.weekStart, record]));
  const thisWeekStart = addCalendarDays(today, -daysSinceMonday(today));
  const firstCounted = weeks
    .filter((record) => record.weekStart <= thisWeekStart && weekCounts(record))
    .map((record) => record.weekStart)
    .sort()[0];
  const endedRuns: WeeklyWalk["endedRuns"] = [];
  let current = 0;
  let longest = 0;

  for (
    let weekStart = firstCounted ?? thisWeekStart;
    weekStart <= thisWeekStart;
    weekStart = addCalendarDays(weekStart, DAYS_PER_WEEK)
  ) {
    if (weekCounts(recordByWeek.get(weekStart))) {
      current += 1;
      longest = Math.max(longest, current);
      if (weekStart < thisWeekStart) {
        endedRuns.push({ weekStart, length: current });
      }
    } else if (weekStart < thisWeekStart) {
      current = 0;
    }
  }

  return {
    current,
    longest,
    thisWeek: weekCounts(recordByWeek.get(thisWeekStart)) ? "complete" : "at_risk",
    endedRuns,
  };
}
