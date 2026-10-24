import { expenditureBand } from "./expenditureBand";
import { addCalendarDays, daysSinceMonday } from "../dates/calendarDay";

import type { ExpenditureBand } from "./expenditureBand";
import type { ProgramSnapshot } from "./types";

/** The most weeks the chart draws: the current week and the 11 before it. */
const MAX_CHART_WEEKS = 12;

const DAYS_PER_WEEK = 7;

/** One week of the expenditure chart. A week with no estimate has a null `kind` and a null `band`. */
export type ExpenditureChartWeek = Readonly<{
  /** The Monday the week starts on, `YYYY-MM-DD`. */
  week: string;
  /** What the week's estimate is: a start snapshot (carried into a later week or not) or a check-in's. */
  kind: ProgramSnapshot["kind"] | null;
  /** The week's estimate and its likely range. */
  band: ExpenditureBand | null;
}>;

const mondayOf = (calendarDate: string): string =>
  addCalendarDays(calendarDate, -daysSinceMonday(calendarDate));

/**
 * The points of the expenditure chart: one for each Monday-start week from the oldest snapshot to the week of
 * `today` (`YYYY-MM-DD`, the user's local date), or to the week of the newest snapshot when that is a check-in,
 * oldest first, the newest 12 at most. A week with several snapshots takes the newest. A week with none
 * carries the snapshot before it only when that is a `start` snapshot, because the belief does not change
 * before the first check-in, so the settling weeks have a value. After a check-in a week without a snapshot is
 * a gap, which only happens between an ended programme and a new one, as the catch-up writes a snapshot for
 * each week it missed. The snapshots may come in any order.
 */
export function expenditureChartWeeks(
  snapshots: readonly ProgramSnapshot[],
  today: string,
): ExpenditureChartWeek[] {
  const newestOfWeek = new Map<string, ProgramSnapshot>();
  for (const snapshot of snapshots) {
    const week = mondayOf(snapshot.asOfDate);
    const held = newestOfWeek.get(week);
    if (held === undefined || snapshot.asOfDate >= held.asOfDate) {
      newestOfWeek.set(week, snapshot);
    }
  }

  const firstWeek = [...newestOfWeek.keys()].sort()[0];
  if (firstWeek === undefined) {
    return [];
  }

  // A check-in leaves the weeks after it empty until the next one, so a chart that ends in a check-in ends there.
  const newest = snapshots.reduce((latest, snapshot) =>
    snapshot.asOfDate >= latest.asOfDate ? snapshot : latest,
  );
  const lastWeek = newest.kind === "checkin" ? mondayOf(newest.asOfDate) : mondayOf(today);

  const weeks: ExpenditureChartWeek[] = [];
  let carried: ProgramSnapshot | null = null;
  for (let week = firstWeek; week <= lastWeek; week = addCalendarDays(week, DAYS_PER_WEEK)) {
    const shown: ProgramSnapshot | null = newestOfWeek.get(week) ?? carried;
    carried = shown?.kind === "start" ? shown : null;
    weeks.push({
      week,
      kind: shown?.kind ?? null,
      band: shown === null ? null : expenditureBand(shown),
    });
  }

  return weeks.slice(-MAX_CHART_WEEKS);
}
