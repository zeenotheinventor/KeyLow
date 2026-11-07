import { describeSets, describeWeekdayName } from "./bodyMap";
import { describeCount } from "./counts";
import { EXPERIENCE_OPTIONS, GOAL_OPTIONS } from "./goals";
import { describeRepRange } from "./routines";
import { addCalendarDays } from "../dates/calendarDay";

import type { ExperienceLevel, TrainingGoal } from "../training/enums";

/*
 * The words of the assistant's training cards, from the approved canvas "Ki-Lo assistant screens". Each
 * tool's block sits apart, so two tools that add words at once merge without touching each other.
 */

/* ---- create_routine (KEY-920): assistant-card · routine-created ---- */

const SEPARATOR = " · ";
/** Any Monday will do: a routine's weekdays are 0 (Monday) to 6 (Sunday), and the day helpers take a date. */
const A_MONDAY = "2026-10-12";

/** "Built routine Push Pull Legs, 3 days", or "1 day". */
export const describeRoutineCreatedTitle = (name: string, dayCount: number): string =>
  `Built routine ${name}, ${describeCount(dayCount, "day", "days")}`;

/** "From your goal: look better, intermediate", in the words of the goal questions, in lower case. */
export const describeRoutineCreatedSub = (
  goal: TrainingGoal,
  experience: ExperienceLevel,
): string =>
  `From your goal: ${GOAL_OPTIONS[goal].label.toLowerCase()}, ${EXPERIENCE_OPTIONS[experience].label.toLowerCase()}`;

/** "Monday · Push", or "Push" for a day with no weekday. */
export const describeBuiltDayName = (name: string, weekday: number | null): string =>
  weekday === null
    ? name
    : `${describeWeekdayName(addCalendarDays(A_MONDAY, weekday))}${SEPARATOR}${name}`;

/** "5 exercises · 15 sets · about 50 min". */
export const describeBuiltDaySummary = (
  exerciseCount: number,
  setCount: number,
  minutes: number,
): string =>
  [
    describeCount(exerciseCount, "exercise", "exercises"),
    describeSets(setCount),
    `about ${minutes} min`,
  ].join(SEPARATOR);

/** "3 sets · 8 to 10 reps · RIR 2". A target RIR of none is left out, and equal reps are one number. */
export const describeBuiltExerciseDetail = (target: {
  sets: number;
  repMin: number;
  repMax: number;
  targetRir: number | null;
}): string =>
  [
    describeSets(target.sets),
    `${describeRepRange(target.repMin, target.repMax)} reps`,
    ...(target.targetRir === null ? [] : [`RIR ${target.targetRir}`]),
  ].join(SEPARATOR);

/** "The week: 45 sets · 3 days". */
export const describeBuiltWeekTotal = (setsPerWeek: number, dayCount: number): string =>
  `The week: ${describeSets(setsPerWeek)}${SEPARATOR}${describeCount(dayCount, "day", "days")}`;

/** "3 days · 45 sets a week", the short fact the changes list shows. */
export const describeRoutineCreatedChange = (dayCount: number, setsPerWeek: number): string =>
  `${describeCount(dayCount, "day", "days")}${SEPARATOR}${describeSets(setsPerWeek)} a week`;

/** The note under a built routine: it is made and kept, and not yet the one the person follows. */
export const ROUTINE_CREATED_NOTE =
  "This is not your active routine. Ask to make it active, or do it in Routines.";

/** The line under "Undone" for a built routine. */
export const describeRoutineCreatedUndone = (name: string): string =>
  `Archived ${name}. You can restore it from Archived in Routines.`;

/** The words of the card's link into the routine editor. */
export const ROUTINE_CREATED_LINK_LABEL = "Open in routine editor";
