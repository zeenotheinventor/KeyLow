import { describeSets, describeWeekdayName } from "./bodyMap";
import { describeCount } from "./counts";
import { EXPERIENCE_OPTIONS, GOAL_OPTIONS } from "./goals";
import { describeRepRange } from "./routines";
import { addCalendarDays } from "../dates/calendarDay";

import type { ExperienceLevel, TrainingGoal } from "../training/enums";

/*
 * The words of the assistant's training cards, from the approved canvas "Ki-Lo assistant screens"
 * (assistant-card routine-active and routine-archived, assistant confirm-training). A string marked NOT ON
 * THE CANVAS is a draft in the board's style that the designers have not drawn, and waits for Zee's
 * approval. Each ticket keeps its own block under its own heading.
 */

// KEY-903: set_active_routine and archive_routine.

/** The link under a routine card, which opens the routine in its editor. */
export const OPEN_IN_ROUTINE_EDITOR = "Open in routine editor";

/** "Push Pull Legs is your active routine". */
export const describeRoutineActiveTitle = (name: string): string =>
  `${name} is your active routine`;

/** "Was Upper Lower · your week plans from it today", and with no routine active before, "Your week plans from it today". */
export const describeRoutineActiveSub = (previousName: string | null): string =>
  previousName === null
    ? "Your week plans from it today"
    : `Was ${previousName} · your week plans from it today`;

/** NOT ON THE CANVAS: the fact the changes list shows for a routine made active, "was Upper Lower". */
export const describeRoutineActiveChangeDetail = (previousName: string): string =>
  `was ${previousName}`;

/** The line under "Undone": "Upper Lower is your active routine again", or "No routine is active" when none was. */
export const describeRoutineActiveUndone = (previousName: string | null): string =>
  previousName === null ? "No routine is active" : `${previousName} is your active routine again`;

/** NOT ON THE CANVAS: the title of the card after the active routine is cleared. */
export const ROUTINE_CLEARED_TITLE = "No routine is active";

/** NOT ON THE CANVAS: the line under that title, "Was Upper Lower". */
export const describeRoutineClearedSub = (previousName: string): string => `Was ${previousName}`;

/** "Archived routine Upper Lower". */
export const describeRoutineArchivedTitle = (name: string): string => `Archived routine ${name}`;

export const ROUTINE_ARCHIVED_SUB = "Sessions you logged with it stay in your history";

/** "Upper Lower is back in your routines". */
export const describeRoutineArchivedUndone = (name: string): string =>
  `${name} is back in your routines`;

/** The archive confirmation: the question is the model's own words, and these are its two buttons. */
export const CONFIRM_ARCHIVE_ROUTINE_BUTTONS = {
  confirm: "Archive routine",
  cancel: "Keep it",
};

/** "Archive Upper Lower? It leaves your routine list. Sessions you logged with it stay in your history." */
export const describeConfirmArchiveRoutineQuestion = (name: string): string =>
  `Archive ${name}? It leaves your routine list. Sessions you logged with it stay in your history.`;

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
