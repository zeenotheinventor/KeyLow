import { describeWeekStripName } from "./diary";
import { WEEK_AVERAGES } from "./weekAverages";
import { WEEK_GRID } from "./weekGrid";
import { formatCalories } from "../format/numbers";

import type { WeekSummary } from "../diary/rules/weekSummary";

/** The sentences of the Dashboard's "This week" card that are not built from numbers, as `dashboard · week*` draws them. */
export const WEEK_CARD = {
  loadingLabel: "Loading this week",
  loadFailed: "Couldn't load this week",
  offlineUnavailable: "This week isn't available offline.",
} as const;

const countedDays = (count: number): string => `${count} ${count === 1 ? "day" : "days"}`;

/** The days complete line: "2 of 4 days complete", or "1 of 1 day complete" on a Monday. */
export const describeDaysComplete = (daysComplete: number, daysSoFar: number): string =>
  `${daysComplete} of ${countedDays(daysSoFar)} complete`;

/** What the average is taken over: "From 4 days with food logged", or "From 1 day with food logged". */
export const describeWeekAverageBasis = (daysLogged: number): string =>
  `From ${countedDays(daysLogged)} with food logged`;

/** How far over the target the average is, written after the value: "+250 kcal". */
export const describeOverTargetKcal = (kcalOverTarget: number): string =>
  `+${formatCalories(kcalOverTarget)} kcal`;

/** The average row's value: "1,681 / 2,200 kcal", or "1,681 kcal" when no target is set. */
export const describeWeekAverageValue = (averageKcal: number, targetKcal: number | null): string =>
  targetKcal === null
    ? `${formatCalories(averageKcal)} kcal`
    : `${formatCalories(averageKcal)} / ${formatCalories(targetKcal)} kcal`;

// The words of the week strip's name for this week. That branch ignores the date, so none is needed.
const THIS_WEEK = describeWeekStripName("", true);

type WeekCardNumbers = Pick<
  WeekSummary,
  "daysSoFar" | "daysComplete" | "isFirstDay" | "daysLogged" | "averageKcal" | "targetKcal"
>;

const describeAverageForScreenReader = ({
  isFirstDay,
  averageKcal,
  targetKcal,
  daysLogged,
}: WeekCardNumbers): string => {
  if (isFirstDay) {
    return WEEK_AVERAGES.startsTomorrow;
  }
  if (averageKcal === null) {
    return WEEK_AVERAGES.nothingBeforeToday;
  }
  const average = formatCalories(averageKcal);
  const against = targetKcal === null ? average : `${average} of ${formatCalories(targetKcal)}`;

  return `${WEEK_GRID.average} ${against} kilocalories a day, ${describeWeekAverageBasis(daysLogged).toLowerCase()} before today.`;
};

const OPENS = {
  diary: "open the diary",
  week: "open the week",
  averages: "open your weekly averages",
} as const;

/**
 * The name of the whole card, which is one pressable surface: both apps open the weekly averages page,
 * and the diary and the week view are kept for a card that opens them. "This week, open your weekly
 * averages. Average 1,895 of 2,200 kilocalories a day, from 3 days with food logged before today. 2 of 4
 * days complete." With no target it drops "of 2,200". On a Monday the average reads as the page's "Your
 * averages start tomorrow.", and with nothing logged before today it says so in the page's words.
 */
export const describeThisWeekCard = (summary: WeekCardNumbers, opens: keyof typeof OPENS): string =>
  [
    `${THIS_WEEK}, ${OPENS[opens]}.`,
    describeAverageForScreenReader(summary),
    `${describeDaysComplete(summary.daysComplete, summary.daysSoFar)}.`,
  ].join(" ");
