import { safeWordsToShow } from "../copy/assistantNotices";
import { describeSets, describeWeekdayName } from "../copy/bodyMap";
import { describeCount } from "../copy/counts";
import { MONTH_NAMES_SHORT, WEEKDAY_NAMES_SHORT } from "../copy/diaryDay";
import { addCalendarDays, parseCalendarDay } from "../dates/calendarDay";

import type { ExerciseTrend } from "../training/exerciseTrend";

/*
 * The one line under an answer that comes from the person's data, and the badge under an answer about
 * the weight trend, as the approved mobile boards print them (canvas "Ki-Lo assistant screens":
 * `assistant · answer`, `assistant · answer-estimate`, `assistant · conversation`). The read tools build
 * the line from what they counted, so the model never words or counts it.
 */

/** The badge of an answer that rests on the trend weight, which is worked out and not measured. */
export const TREND_ESTIMATE = "Trend weight is an estimate";

const monthOf = (localDate: string): string => {
  const { month } = parseCalendarDay(localDate);

  return MONTH_NAMES_SHORT[month - 1] ?? "";
};

const dateWithMonth = (localDate: string): string =>
  `${parseCalendarDay(localDate).day} ${monthOf(localDate)}`;

const dateWithMonthAndYear = (localDate: string): string =>
  `${dateWithMonth(localDate)} ${parseCalendarDay(localDate).year}`;

/** "12 Oct", "12 to 18 Oct", "28 Sep to 4 Oct", or "28 Dec 2026 to 3 Jan 2027" when the years differ. */
const describeDateRange = (from: string, to: string): string => {
  if (from === to) {
    return dateWithMonth(from);
  }
  const start = parseCalendarDay(from);
  const end = parseCalendarDay(to);
  if (start.year !== end.year) {
    return `${dateWithMonthAndYear(from)} to ${dateWithMonthAndYear(to)}`;
  }
  return start.month === end.month
    ? `${start.day} to ${dateWithMonth(to)}`
    : `${dateWithMonth(from)} to ${dateWithMonth(to)}`;
};

/** A day as a short date with its weekday, "Sat 24 Oct". */
const describeShortDate = (localDate: string): string => {
  const { year, month, day } = parseCalendarDay(localDate);
  const weekday = WEEKDAY_NAMES_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return `${weekday} ${day} ${MONTH_NAMES_SHORT[month - 1]}`;
};

type RangeInput = { from: string; to: string };

/**
 * The line under an answer about a range of days: "Based on 38 entries, 12 to 18 Oct". A range with
 * nothing in it says so, "No entries, 12 to 18 Oct", and is never an error.
 */
export const describeRangeCitation = ({
  from,
  to,
  entryCount,
}: RangeInput & { entryCount: number }): string =>
  entryCount === 0
    ? `No entries, ${describeDateRange(from, to)}`
    : `Based on ${describeCount(entryCount, "entry", "entries")}, ${describeDateRange(from, to)}`;

/** The line under an answer about the weight: "Based on 24 weigh-ins, 21 Sep to 18 Oct". */
export const describeWeighInCitation = ({
  from,
  to,
  count,
}: RangeInput & { count: number }): string =>
  count === 0
    ? `No weigh-ins, ${describeDateRange(from, to)}`
    : `Based on ${describeCount(count, "weigh-in", "weigh-ins")}, ${describeDateRange(from, to)}`;

/**
 * The line under an answer about logged workouts, as the board `assistant · answer-training` draws it:
 * "Based on 2 workouts, 12 to 13 Oct". One workout read by itself gives its own day twice, "Based on 1
 * workout, 8 Oct". A range with nothing in it says so, "No workouts, 12 to 13 Oct", and is never an error.
 */
export const describeWorkoutsCitation = ({
  from,
  to,
  workoutCount,
}: RangeInput & { workoutCount: number }): string =>
  workoutCount === 0
    ? `No workouts, ${describeDateRange(from, to)}`
    : `Based on ${describeCount(workoutCount, "workout", "workouts")}, ${describeDateRange(from, to)}`;

/**
 * The line under an answer about one day and the person's targets: "Based on 4 entries today and your
 * targets". The day is named as today or yesterday, and otherwise by its short date, "Sat 24 Oct". A day
 * with no entries says "No entries today" and does not mention the targets.
 */
export const describeDayCitation = ({
  localDate,
  today,
  entryCount,
}: {
  localDate: string;
  today: string;
  entryCount: number;
}): string => {
  const day =
    localDate === today
      ? "today"
      : localDate === addCalendarDays(today, -1)
        ? "yesterday"
        : `on ${describeShortDate(localDate)}`;

  return entryCount === 0
    ? `No entries ${day}`
    : `Based on ${describeCount(entryCount, "entry", "entries")} ${day} and your targets`;
};

/**
 * The line under an answer that reads one routine: "Based on your routine Push Pull Legs". No board draws it,
 * the words are the designer's note on the canvas, recorded on KEY-881. The name is the person's own text, so
 * it is cleaned and cut like any words shown from outside, and a name with nothing left is left out.
 */
export const describeRoutineCitation = (routineName: string): string => {
  const name = safeWordsToShow(routineName);

  return name === null ? "Based on your routine" : `Based on your routine ${name}`;
};

/**
 * The line under an answer about the muscles, as `assistant · answer-training` prints it: "Based on 18 sets
 * for your back, 8 to 14 Oct", the 7 days the sets were counted over. With no area it names the muscles and
 * not a count, because the sets of all the muscles count a set once for each muscle it works.
 */
export const describeMuscleCitation = ({
  area,
  sets,
  from,
  to,
}: RangeInput & { area: string | null; sets: number }): string => {
  const range = describeDateRange(from, to);
  if (sets === 0) {
    return `No sets${area === null ? "" : ` for your ${area}`}, ${range}`;
  }

  return area === null
    ? `Based on your muscles, ${range}`
    : `Based on ${describeSets(sets)} for your ${area}, ${range}`;
};

/**
 * The line under an answer about the suggested session, as `assistant · answer-suggestion` prints it: "Based
 * on Ki-Lo's suggestion for Thursday", and "for today" when the day is today.
 */
export const describeSuggestionCitation = ({
  localDate,
  today,
}: {
  localDate: string;
  today: string;
}): string =>
  `Based on Ki-Lo's suggestion for ${localDate === today ? "today" : describeWeekdayName(localDate)}`;
const DAYS_FROM_MONDAY_TO_SUNDAY = 6;

/**
 * The line under an answer about one exercise's weeks: "Based on 6 weeks of bench press, 7 Sep to 11 Oct",
 * from the Monday of the first trained week to the Sunday that ends the latest. Only trained weeks are
 * counted, so a skipped week is not one. The name is the exercise's, which a person wrote for their own,
 * so it is cleaned and cut like any words shown from outside and put in lower case, and a name with
 * nothing left reads "this exercise".
 */
export const describeProgressCitation = (exerciseName: string, trend: ExerciseTrend): string => {
  const name = safeWordsToShow(exerciseName)?.toLowerCase() ?? "this exercise";
  const trained = trend.weeks.filter((entry) => entry.value !== null);
  const first = trained.at(0);
  const last = trained.at(-1);

  return first === undefined || last === undefined
    ? `No weeks of ${name}`
    : `Based on ${describeCount(trained.length, "week", "weeks")} of ${name}, ${describeDateRange(
        first.weekStart,
        addCalendarDays(last.weekStart, DAYS_FROM_MONDAY_TO_SUNDAY),
      )}`;
};
