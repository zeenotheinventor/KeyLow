import { describeLongDate } from "./assistantDayCards";
import { describeSets, describeWeekdayName } from "./bodyMap";
import { describeCount } from "./counts";
import { EXPERIENCE_OPTIONS, GOAL_OPTIONS } from "./goals";
import { describeRepRange } from "./routines";
import { SET_PHRASES, writtenNumbers } from "./sessionWording";
import { addCalendarDays } from "../dates/calendarDay";

import type { ExperienceLevel, TrainingGoal } from "../training/enums";
import type { LoadUnit } from "../training/loads";
import type { SetValues } from "../training/setInput";

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

// KEY-902: edit_routine, its card, its removal question and the refusals that follow a workout starting.

/*
 * A routine, a day and an exercise name are health data, so a sentence here only repeats a name it was
 * given and never logs one.
 */

const SEPARATOR = " · ";

// Monday is 0, as a routine day's weekday is.
const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** "Friday", or "Any day" for a day with no weekday. */
export const describeRoutineWeekday = (weekday: number | null): string =>
  weekday === null ? "Any day" : (WEEKDAY_NAMES[weekday] ?? "Any day");

/** "Updated routine Push Pull Legs". */
export const describeRoutineUpdatedTitle = (routineName: string): string =>
  `Updated routine ${routineName}`;

/** "1 change", "4 changes". */
export const describeRoutineChangeCount = (count: number): string =>
  count === 1 ? "1 change" : `${count} changes`;

/** "Legs · 4 changes": every change is to the exercises of one day. */
export const describeRoutineUpdatedSubForDay = (dayName: string, count: number): string =>
  `${dayName}${SEPARATOR}${describeRoutineChangeCount(count)}`;

/** "3 changes to days": every change is to the days themselves. */
export const describeRoutineDayChangeCount = (count: number): string =>
  count === 1 ? "1 change to a day" : `${count} changes to days`;

/** The line under "Undone": "Put Push Pull Legs back as it was". */
export const describeRoutineUpdatedUndone = (routineName: string): string =>
  `Put ${routineName} back as it was`;

/** What a routine exercise is given, for the rows of a card. A null target RIR is one nobody set. */
export type RoutineTargetWords = {
  sets: number;
  repMin: number;
  repMax: number;
  targetRir: number | null;
};

const describeReps = (repMin: number, repMax: number): string =>
  `${describeRepRange(repMin, repMax)} ${repMax === 1 ? "rep" : "reps"}`;

/** "3 sets, 12 to 15 reps, RIR 1". NOT ON THE CANVAS when no RIR was set: it is left out. */
export const describeRoutineTargets = ({
  sets,
  repMin,
  repMax,
  targetRir,
}: RoutineTargetWords): string =>
  [
    describeSets(sets),
    describeReps(repMin, repMax),
    ...(targetRir === null ? [] : [`RIR ${targetRir}`]),
  ].join(", ");

const detailOf = (dayName: string, rest: string | null): string =>
  rest === null ? dayName : `${dayName}${SEPARATOR}${rest}`;

/** "Added Leg extension", with "Legs · 3 sets, 12 to 15 reps, RIR 1" under it. */
export const describeAddedExerciseRow = (
  exerciseName: string,
  dayName: string,
  targets: RoutineTargetWords,
) => ({
  name: `Added ${exerciseName}`,
  detail: detailOf(dayName, describeRoutineTargets(targets)),
});

/** "Swapped Leg press for Hack squat", with the numbers the swap kept under it. A swap whose old numbers are not known has the day only. */
export const describeSwappedExerciseRow = (
  oldExerciseName: string,
  newExerciseName: string,
  dayName: string,
  targets: RoutineTargetWords | null,
) => ({
  name: `Swapped ${oldExerciseName} for ${newExerciseName}`,
  detail: detailOf(dayName, targets === null ? null : describeRoutineTargets(targets)),
});

/** "Removed Seated leg curl", with the day under it. */
export const describeRemovedExerciseRow = (exerciseName: string, dayName: string) => ({
  name: `Removed ${exerciseName}`,
  detail: dayName,
});

const withWas = (now: string, was: string | null): string =>
  was === null ? now : `${now}, was ${was}`;

const rirWords = (targetRir: number | null): string =>
  targetRir === null ? "not set" : String(targetRir);

/**
 * "Changed Barbell squat", with "Legs · 4 sets, was 3 · 5 to 8 reps, RIR 2" under it: the numbers it has now,
 * and what a changed number was. A number that did not change has no "was", and `was` is null when the
 * exercise's old numbers are not known, so nothing says "was" then. Only the sets case is on the canvas.
 */
export const describeChangedTargetsRow = (
  exerciseName: string,
  dayName: string,
  now: RoutineTargetWords | null,
  was: RoutineTargetWords | null,
) => {
  if (now === null) {
    return { name: `Changed ${exerciseName}`, detail: dayName };
  }
  const setsWas = was !== null && was.sets !== now.sets ? String(was.sets) : null;
  const repsWas =
    was !== null && (was.repMin !== now.repMin || was.repMax !== now.repMax)
      ? describeRepRange(was.repMin, was.repMax)
      : null;
  const rirWas = was !== null && was.targetRir !== now.targetRir ? rirWords(was.targetRir) : null;
  const repsAndRir = [
    withWas(describeReps(now.repMin, now.repMax), repsWas),
    ...(now.targetRir === null && rirWas === null
      ? []
      : [withWas(`RIR ${rirWords(now.targetRir)}`, rirWas)]),
  ].join(", ");
  return {
    name: `Changed ${exerciseName}`,
    detail: detailOf(
      dayName,
      [withWas(describeSets(now.sets), setsWas), repsAndRir].join(SEPARATOR),
    ),
  };
};

/** "Added day Arms", with "Saturday · no exercises yet" under it. A day that already has exercises says its weekday only. */
export const describeAddedDayRow = (
  dayName: string,
  weekday: number | null,
  exerciseCount: number,
) => ({
  name: `Added day ${dayName}`,
  detail: detailOf(
    describeRoutineWeekday(weekday),
    exerciseCount === 0 ? "no exercises yet" : null,
  ),
});

/** "Renamed Push to Chest and shoulders", with the day's weekday under it. */
export const describeRenamedDayRow = (
  oldName: string,
  newName: string,
  weekday: number | null,
) => ({
  name: `Renamed ${oldName} to ${newName}`,
  detail: describeRoutineWeekday(weekday),
});

/** "Moved Legs to Friday", with "Was Thursday" under it. */
export const describeMovedDayRow = (
  dayName: string,
  weekday: number | null,
  was: number | null,
) => ({
  name: `Moved ${dayName} to ${describeRoutineWeekday(weekday)}`,
  detail: `Was ${was === null ? "any day" : describeRoutineWeekday(was)}`,
});

/** NOT ON THE CANVAS: "Moved Legs to day 2", with "Order of the days" under it. `place` counts from 1. */
export const describeReorderedDayRow = (dayName: string, place: number) => ({
  name: `Moved ${dayName} to day ${place}`,
  detail: "Order of the days",
});

/** "Remove 2 exercises from Legs in Push Pull Legs? Leg press and Seated leg curl. Sessions you logged keep them." */
export const describeConfirmRemoveExercisesQuestion = (
  exerciseNames: readonly string[],
  dayName: string | null,
  routineName: string,
): string => {
  const place = dayName === null ? routineName : `${dayName} in ${routineName}`;
  const names =
    exerciseNames.length < 2
      ? exerciseNames.join("")
      : `${exerciseNames.slice(0, -1).join(", ")} and ${exerciseNames.at(-1)}`;
  return `Remove ${exerciseNames.length} exercises from ${place}? ${names}. Sessions you logged keep them.`;
};

export const CONFIRM_REMOVE_EXERCISES_BUTTONS = {
  /** "Remove 2". */
  confirm: (count: number): string => `Remove ${count}`,
  cancel: "Keep them",
};

/**
 * The answer to a request to remove a day, which `edit_routine` never applies. The words of the board
 * `assistant-card · routine-updated`, "Removing a day".
 */
export const REMOVE_DAY_REFUSAL =
  "A day can only be removed in the routine editor, because removing it unlinks the sessions you logged from it. Exercises can be changed here.";

/**
 * The words of a confirm button pressed after a workout started, when no model answers: two paragraphs, the
 * board's `assistant · workout-in-progress` without the name of the workout, which only a model's own reply
 * can know.
 */
export const describeWorkoutInProgressRefusal = (): string =>
  "Your workout is in progress, so nothing in your training can change yet. Questions are still fine.\n\nFinish it or discard it on the Train tab, then ask again.";

// update_past_set (KEY-906), `assistant-card · set-updated`.

/** The link under the card, to the workout the set belongs to. */
export const SET_UPDATED_LINK_LABEL = "Open the session";

const SET_TYPE_WORDS: Record<SetValues["setType"], string> = {
  warmup: "warm-up",
  working: "working",
  drop: "drop",
  failure: "failure",
};

/** The place a set was changed, as the title names it: "Legs", or "your workout" for a session that follows no routine day (NOT ON THE CANVAS). */
export const describeSetUpdatedPlace = (dayName: string | null): string =>
  dayName ?? "your workout";

/** "Changed a set in Legs", and "Changed 3 sets in Legs" once several calls of one workout are one card. */
export const describeSetUpdatedTitle = (place: string, count: number): string =>
  `Changed ${count === 1 ? "a set" : `${count} sets`} in ${place}`;

/** The sub-line of the card: the workout's day, "Thursday 8 October". */
export const describeSetUpdatedSub = (localDate: string): string => describeLongDate(localDate);

/** "Barbell squat, set 2". A warm-up, a drop set and a failure set have no number of their own (NOT ON THE CANVAS). */
export const describeSetRowName = (
  exerciseName: string,
  setType: SetValues["setType"],
  setNumber: number,
): string => `${exerciseName}, ${SET_PHRASES[setType](setNumber).toLowerCase()}`;

const effortWords = ({ rir, rpe }: Pick<SetValues, "rir" | "rpe">): string => {
  if (rir !== null) {
    return `RIR ${rir}`;
  }
  return rpe === null ? "no RIR" : `RPE ${rpe}`;
};

/**
 * A set's numbers as the row writes them: "100 kg × 8", or "8 reps" with no load. The effort and the type
 * follow when the call changed them, so that a row never reads "Was 100 kg × 8" over "100 kg × 8". Both
 * additions are NOT ON THE CANVAS: the board changes reps and load only.
 */
export const describeSetFigures = (
  set: SetValues,
  unit: LoadUnit,
  show: Readonly<{ effort: boolean; type: boolean }>,
): string =>
  [
    writtenNumbers(set, unit, ` ${unit}`),
    ...(show.effort ? [effortWords(set)] : []),
    ...(show.type ? [SET_TYPE_WORDS[set.setType]] : []),
  ].join(", ");

/** "Was 100 kg × 6", the detail of a changed row. */
export const describeSetWas = (figures: string): string => `Was ${figures}`;

const lowerFirst = (text: string): string =>
  /^[A-Z]{2}/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1);

/** "Put back barbell squat, set 2, to 100 kg × 6", the line under Undone for one set. */
export const describeSetPutBack = (rowName: string, figures: string): string =>
  `Put back ${lowerFirst(rowName)}, to ${figures}`;

/** "Put back 3 sets in Legs" (NOT ON THE CANVAS), and "Put back 3 sets" for sets of several workouts. */
export const describeSetsPutBack = (count: number, place: string | null): string =>
  `Put back ${count} sets${place === null ? "" : ` in ${place}`}`;

/*
 * `assistant-card · goals-updated` (KEY-904).
 */

/** The title of the card after the person's goal changed. */
export const GOALS_UPDATED_TITLE = "Updated your training goals";

/** The title of the card after a first goal. */
export const GOALS_SAVED_TITLE = "Saved your training goals";

/** The note under an update. */
export const GOALS_UPDATED_NOTE =
  "Your next suggestions use these goals. Your routines stay as they are.";

/** The line under "Undone" when the card saved a first goal, so the person has no goal again. */
export const GOALS_CLEARED_UNDONE = "Your training goals are cleared";

/** "Was Look better", the detail of a changed answer's row. */
export const describeGoalWas = (previousValue: string): string => `Was ${previousValue}`;

/** "goal, days a week", the short fact the changes list shows. The names are the Goal screen's, lower case. */
export const describeGoalsChangeDetail = (rowNames: readonly string[]): string =>
  rowNames.map((name) => name.toLowerCase()).join(", ");

/** "3 days a week", for the note and the line under "Undone". */
export const describeGoalDays = (days: number): string =>
  `${describeCount(days, "day", "days")} a week`;

/** "45 minutes", for the note. */
export const describeGoalMinutes = (minutes: number): string =>
  describeCount(minutes, "minute", "minutes");

/**
 * NOT ON THE CANVAS (KEY-904, the orchestrator's own wording for Zee's review): the note under a first goal,
 * which says what the code chose because the person was asked only for their goal and experience. "Also set
 * to start: 3 days a week, 60 minutes, full gym. Change them on the Goal screen."
 */
export const describeGoalsStartedNote = (chosen: readonly string[]): string =>
  `Also set to start: ${chosen.join(", ")}. Change ${chosen.length === 1 ? "it" : "them"} on the Goal screen.`;

/**
 * "Put back your goal, Look better, and 4 days a week", the line under "Undone". Each item is one changed
 * answer as it was. The board puts a comma before "and" for two items, so the list keeps it.
 */
export const describeGoalsPutBack = (previous: readonly string[]): string => {
  const last = previous.at(-1) ?? "";
  return `Put back ${previous.length < 2 ? last : `${previous.slice(0, -1).join(", ")}, and ${last}`}`;
};

/** "45 minutes a session", one changed answer as it was, for the line under "Undone". */
export const describeGoalMinutesPutBack = (minutes: number): string =>
  `${describeGoalMinutes(minutes)} a session`;

/** "your goal, Look better", one changed answer as it was, for the line under "Undone". */
export const describeGoalAnswerPutBack = (name: string, previousValue: string): string =>
  `your ${name.toLowerCase()}, ${previousValue}`;

/** "no focus", the focus as it was when it was empty, for the line under "Undone". */
export const GOALS_NO_FOCUS_PUT_BACK = "no focus";

/* ---- create_routine (KEY-920): assistant-card · routine-created ---- */

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
