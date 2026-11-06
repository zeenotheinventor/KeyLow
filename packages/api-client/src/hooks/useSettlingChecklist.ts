import {
  acceptedWeighInDates,
  buildSettlingChecklistView,
  checkinWindowWeeks,
  completeDayDates,
  firstCheckinReadiness,
} from "@keylow/core/program";

import { useDiaryWeek } from "./useDiaryWeek";
import { useWeighIns } from "./useWeighIns";
import { useWeightTrend } from "./useWeightTrend";

import type { SettlingChecklistInput, SettlingChecklistView } from "@keylow/core/program";

/** What `useSettlingChecklist` takes: the checklist's input, and whether the reads may run. */
export type UseSettlingChecklistOptions = SettlingChecklistInput & {
  /** False makes no request at all, as the diary reads do. */
  enabled: boolean;
};

/**
 * What the first check-in needs so far, from the weigh-in trend and the diary weeks the check-in's window
 * touches, four or five. A day is complete as the check-in counts it: marked complete and with something
 * logged, from the same day logs and day totals the week reads. Null until all of it has been read, and when a
 * read fails, so a count of 0 is never drawn for a count that is not known. Nothing is read while `enabled` is
 * false. Nothing here is logged: the dates and counts are health data.
 */
export function useSettlingChecklist({
  enabled,
  firstCheckinDate,
  daysLeft,
  today,
}: UseSettlingChecklistOptions): SettlingChecklistView | null {
  const weighIns = useWeighIns({ enabled });
  const trend = useWeightTrend({ enabled });
  const {
    weekStarts: [firstWeek, secondWeek, thirdWeek, fourthWeek, fifthWeek],
    touchesFifthWeek,
  } = checkinWindowWeeks(firstCheckinDate);
  const weeks = [
    useDiaryWeek(firstWeek, { enabled }),
    useDiaryWeek(secondWeek, { enabled }),
    useDiaryWeek(thirdWeek, { enabled }),
    useDiaryWeek(fourthWeek, { enabled }),
    // A window that ends before the fifth Monday does not read it.
    useDiaryWeek(fifthWeek, { enabled: enabled && touchesFifthWeek }),
  ];

  const weeksNeeded = touchesFifthWeek ? weeks : weeks.slice(0, 4);
  const weeksRead = weeksNeeded.flatMap((week) => (week.isSuccess ? [week.data] : []));
  if (!weighIns.isSuccess || weeksRead.length < weeksNeeded.length) {
    return null;
  }

  const readiness = firstCheckinReadiness({
    asOfDate: firstCheckinDate,
    today,
    weighInDates: acceptedWeighInDates(trend.points),
    completeDates: completeDayDates(
      weeksRead.flat().map(({ localDate, dayLog, totals }) => ({
        localDate,
        intakeKcal: totals?.kcal ?? null,
        isComplete: dayLog?.is_complete === true,
      })),
    ),
  });

  return buildSettlingChecklistView({ firstCheckinDate, daysLeft, readiness });
}
