import {
  describeSets,
  describeShortDate,
  describeWeekdayName,
  describeWeekdayShortName,
} from "./bodyMap";
import { describeCount } from "./counts";
import { describeDateInWords } from "./diary";
import { addCalendarDays } from "../dates/calendarDay";
import {
  MAX_DAYS_PER_ROUTINE,
  MAX_EXERCISES_PER_ROUTINE_DAY,
  MAX_RIR,
  MAX_ROUTINE_DAY_NAME_LENGTH,
  MAX_ROUTINE_NAME_LENGTH,
  MAX_TARGET_REPS,
  MAX_TARGET_SETS,
  MAX_WEEKDAY,
  MIN_RIR,
  MIN_TARGET_REPS,
  MIN_TARGET_SETS,
} from "../training/bounds";

import type { RoutineDraftRule } from "../training/routineDraft";

/*
 * The words of the routines list, the archived list, the routine editor and the make active confirmation,
 * as the boards `routines · *` and `RoutinesScreen` draw them (KEY-336, canvas version 30). Data in,
 * sentence out: every count, name and date in a sentence comes from the input. A routine, day or exercise
 * name in a sentence is never logged, and no sentence echoes a value the person typed.
 */

/** The fixed words of the Routines list. */
export const ROUTINES_SCREEN = {
  title: "Routines",
  backLabel: "Back to Train",
  newRoutineLabel: "New routine",
  /** The section name, and the pill on the active routine's card. */
  activeLabel: "Active",
  otherSectionName: "Other routines",
  makeActiveAction: "Make active",
} as const;

/** The card shown when there is no routine yet. */
export const ROUTINES_EMPTY = {
  title: "No routines yet",
  body: "A routine plans your training days, so Ki-Lo can show where your week is heading.",
  action: "Create routine",
} as const;

/** The fixed words of the archived routines list. */
export const ROUTINES_ARCHIVED = {
  title: "Archived",
  backLabel: "Back to Routines",
  restoreAction: "Restore",
  note: "Archived routines keep the sessions you logged with them. Restore one to plan with it again.",
} as const;

/**
 * The toast after a routine is archived from its editor, with Undo. The boards do not draw it: no board
 * draws Archive, its menu or this toast.
 */
export const ROUTINE_ARCHIVED_TOAST = {
  message: "Routine archived",
  undoAction: "Undo",
} as const;

/**
 * The refusal when the active routine is archived: the caption under the dimmed Archive routine item, and
 * the toast when the database refuses an archive the screen did not know was refused. The boards do not draw it.
 */
export const ARCHIVE_ACTIVE_REFUSAL = "Make another routine active first.";

/**
 * The toast when making a routine active did not go through, offline or on a failed write. It names no
 * routine and says nothing of what the list now shows, since the read after a write can fail on its own.
 * The boards do not draw it.
 */
export const ROUTINE_MAKE_ACTIVE_FAILED =
  "Your routine was not made active. Check your connection, then try again.";

/** The toast when restoring a routine did not go through, worded as the one above. The boards do not draw it. */
export const ROUTINE_RESTORE_FAILED =
  "Your routine was not restored. Check your connection, then try again.";

/** The toast when archiving a routine did not go through, worded as the one above. The boards do not draw it. */
export const ROUTINE_ARCHIVE_FAILED =
  "Your routine was not archived. Check your connection, then try again.";

/** The caption under the dimmed Archive routine item while the draft has changes that are not saved. The boards do not draw it. */
export const ROUTINE_ARCHIVE_UNSAVED = "Save or cancel your changes first.";

/** The fixed words of the routine editor. */
export const ROUTINE_EDITOR = {
  title: "Edit routine",
  /** The title when the routine is being created. The boards do not draw it. */
  newTitle: "New routine",
  cancelLabel: "Cancel editing",
  saveAction: "Save",
  nameLabel: "Name",
  daysHeading: "Days",
  exerciseHeading: "Exercise",
  setsHeading: "Sets",
  repsHeading: "Reps",
  rirHeading: "RIR",
  addExerciseAction: "Add exercise",
  /** The name of the header's menu control and of the sheet it opens. The boards do not draw them. */
  moreLabel: "More for this routine",
  /** The one item in that menu. The boards do not draw it. */
  archiveAction: "Archive routine",
} as const;

const SEPARATOR = " · ";
/** Any Monday will do: the routine's weekdays are 0 (Monday) to 6 (Sunday), and the day helpers take a date. */
const A_MONDAY = "2026-10-12";
const WEEKDAYS = Array.from({ length: MAX_WEEKDAY + 1 }, (_, weekday) => weekday);
const REST_LABEL = "Rest";
const ANY_WEEKDAY_LABEL = "Any";

const describeDayCount = (count: number): string => describeCount(count, "day", "days");

const describeSetsAWeek = (setsPerWeek: number): string => `${describeSets(setsPerWeek)} a week`;

const weekdayDate = (weekday: number): string => addCalendarDays(A_MONDAY, weekday);

/** The link to the archived routines: "Archived · 1". */
export const describeArchivedRoutinesLink = (archivedCount: number): string =>
  `Archived${SEPARATOR}${archivedCount}`;

/** A routine day as the list cards read it. */
export type RoutineCardDay = Readonly<{
  name: string;
  /** 0 (Monday) to 6 (Sunday), or null for any day. */
  weekday: number | null;
}>;

export type RoutineCardInput = Readonly<{
  days: readonly RoutineCardDay[];
  /** `summariseRoutine`'s sets in a week. */
  setsPerWeek: number;
}>;

export type ActiveRoutineInput = RoutineCardInput &
  Readonly<{
    name: string;
    /** The calendar day the routine began to plan from, `YYYY-MM-DD`, or null when it is not known. */
    activeFrom: string | null;
  }>;

export type RoutineWeekDayCopy = {
  /** The column head: "Mon". */
  weekday: string;
  /** The routine day on that weekday, or Rest. */
  label: string;
};

export type ActiveRoutineCopy = {
  /** "4 days · 63 sets a week · since Mon 21 Sep", or "4 days · 63 sets a week" without the date. */
  meta: string;
  /** The seven weekdays of the card's strip, Monday first. */
  week: RoutineWeekDayCopy[];
  /** "Push Pull Legs, active, 4 days, Monday Tuesday Thursday Saturday, 63 sets a week": the name of a card that opens nothing. */
  readName: string;
  /** `readName` and ". Edit": the name of a card that opens the editor. */
  accessibleName: string;
};

/** The weekdays some day is on, Monday first. */
const datedWeekdays = (days: readonly RoutineCardDay[]): number[] =>
  WEEKDAYS.filter((weekday) => days.some((day) => day.weekday === weekday));

/** The words of the active routine's card. A day with no weekday counts but has no place in the strip. */
export const describeActiveRoutine = ({
  name,
  days,
  setsPerWeek,
  activeFrom,
}: ActiveRoutineInput): ActiveRoutineCopy => {
  const dayCount = describeDayCount(days.length);
  const setsAWeek = describeSetsAWeek(setsPerWeek);
  const weekdayNames = datedWeekdays(days).map((weekday) =>
    describeWeekdayName(weekdayDate(weekday)),
  );
  const readName = [
    name,
    ROUTINES_SCREEN.activeLabel.toLowerCase(),
    dayCount,
    ...(weekdayNames.length === 0 ? [] : [weekdayNames.join(" ")]),
    setsAWeek,
  ].join(", ");
  return {
    meta: [
      dayCount,
      setsAWeek,
      ...(activeFrom === null ? [] : [`since ${describeShortDate(activeFrom)}`]),
    ].join(SEPARATOR),
    week: WEEKDAYS.map((weekday) => ({
      weekday: describeWeekdayShortName(weekdayDate(weekday)),
      label: days.find((day) => day.weekday === weekday)?.name ?? REST_LABEL,
    })),
    readName,
    accessibleName: `${readName}. Edit`,
  };
};

/** The meta of a routine in the list of other routines: "4 days · Mon, Tue, Thu, Fri · 60 sets a week". */
export const describeOtherRoutineMeta = ({ days, setsPerWeek }: RoutineCardInput): string => {
  const weekdays = datedWeekdays(days).map((weekday) =>
    describeWeekdayShortName(weekdayDate(weekday)),
  );
  return [
    describeDayCount(days.length),
    ...(weekdays.length === 0 ? [] : [weekdays.join(", ")]),
    describeSetsAWeek(setsPerWeek),
  ].join(SEPARATOR);
};

export type ArchivedRoutineInput = Readonly<{
  dayCount: number;
  /** The calendar day it was archived, `YYYY-MM-DD`, or null when it is not known. */
  archivedOn: string | null;
}>;

/** The meta of an archived routine: "3 days · archived Wed 2 Sep", or "3 days" without the date. */
export const describeArchivedRoutineMeta = ({
  dayCount,
  archivedOn,
}: ArchivedRoutineInput): string =>
  [
    describeDayCount(dayCount),
    ...(archivedOn === null ? [] : [`archived ${describeShortDate(archivedOn)}`]),
  ].join(SEPARATOR);

/**
 * The name of a Make active button, which the row's own words do not name: "Make active, Upper Lower".
 * It starts with the button's visible text, so a person who speaks the label reaches it (WCAG 2.5.3).
 */
export const describeMakeActiveName = (routineName: string): string =>
  `${ROUTINES_SCREEN.makeActiveAction}, ${routineName}`;

/** The name of a Restore button, which the row's own words do not name: "Restore Starting strength". */
export const describeRestoreName = (routineName: string): string => `Restore ${routineName}`;

export type MakeActiveInput = Readonly<{
  routineName: string;
  /** The routine that is active now, or null for none. */
  previousActiveName: string | null;
  /** Today, `YYYY-MM-DD`: the routine plans from it. */
  localDate: string;
}>;

export type MakeActiveCopy = {
  /** "Make Upper Lower active?". */
  title: string;
  body: string;
  confirmAction: string;
  cancelAction: string;
};

/** The make active confirmation. */
export const describeMakeActiveDialog = ({
  routineName,
  previousActiveName,
  localDate,
}: MakeActiveInput): MakeActiveCopy => {
  const plansFrom = `It plans from today, ${describeDateInWords(localDate)}.`;
  return {
    title: `Make ${routineName} active?`,
    body:
      previousActiveName === null
        ? `${plansFrom} The sessions you logged keep their days.`
        : `${plansFrom} ${previousActiveName} stays saved, and the sessions you logged keep their days.`,
    confirmAction: ROUTINES_SCREEN.makeActiveAction,
    cancelAction: "Cancel",
  };
};

/** The banner above a routine that cannot be saved: "Fix the 3 problems marked below to save this routine." */
export const describeProblemsBanner = (problemCount: number): string =>
  `Fix the ${problemCount === 1 ? "problem" : `${problemCount} problems`} marked below to save this routine.`;

export type DaysSummaryInput = Readonly<{
  dayCount: number;
  /** `summariseRoutine`'s sets in a week. */
  setsPerWeek: number;
}>;

/** The editor's days heading note: "4 of 7 · 63 sets a week". */
export const describeDaysSummary = ({ dayCount, setsPerWeek }: DaysSummaryInput): string =>
  `${dayCount} of ${MAX_DAYS_PER_ROUTINE}${SEPARATOR}${describeSetsAWeek(setsPerWeek)}`;

export type EditorDayInput = Readonly<{
  name: string;
  /** 0 (Monday) to 6 (Sunday), or null for any day. */
  weekday: number | null;
  exerciseCount: number;
  setCount: number;
  /** Whether the day's exercises are showing. */
  isOpen: boolean;
}>;

export type EditorDayCopy = {
  /** "5 exercises · 15 sets". */
  meta: string;
  /** The weekday chip: "Tue", or "Any" for a day with no weekday. */
  weekdayLabel: string;
  /** "Weekday for Pull: Tuesday". */
  weekdayAccessibleName: string;
  /** "Show Pull exercises" while closed and "Hide Pull exercises" while open. */
  toggleAccessibleName: string;
};

/** The words of one day's header in the editor. */
export const describeEditorDay = ({
  name,
  weekday,
  exerciseCount,
  setCount,
  isOpen,
}: EditorDayInput): EditorDayCopy => ({
  meta: [describeCount(exerciseCount, "exercise", "exercises"), describeSets(setCount)].join(
    SEPARATOR,
  ),
  weekdayLabel:
    weekday === null ? ANY_WEEKDAY_LABEL : describeWeekdayShortName(weekdayDate(weekday)),
  weekdayAccessibleName: `Weekday for ${name}: ${
    weekday === null ? "any day" : describeWeekdayName(weekdayDate(weekday))
  }`,
  toggleAccessibleName: `${isOpen ? "Hide" : "Show"} ${name} exercises`,
});

export type ExerciseFieldNames = {
  /** "Sets for Barbell Squat". */
  sets: string;
  reps: string;
  rir: string;
};

/** The accessible names of an exercise row's three fields, which the row's column heads do not give a screen reader. */
export const describeExerciseFieldNames = (exerciseName: string): ExerciseFieldNames => ({
  sets: `Sets for ${exerciseName}`,
  reps: `Reps for ${exerciseName}`,
  rir: `RIR for ${exerciseName}`,
});

/**
 * The name of the button that takes an exercise out of a day: "Remove Barbell squat". The boards draw no
 * such button (KEY-450 proposes these words, to be drawn by the designers).
 */
export const describeRemoveExercise = (exerciseName: string): string => `Remove ${exerciseName}`;

/** The reps field's text: "5 to 8", or "8" when the two are the same. */
export const describeRepRange = (repMin: number, repMax: number): string =>
  repMin === repMax ? String(repMin) : `${repMin} to ${repMax}`;

/** Every `RoutineDraftRule` has its sentence, so a rule added without one does not compile. */
const RULE_SENTENCES: Record<RoutineDraftRule, (weekday: number | null) => string> = {
  routine_name_blank: () => "Give the routine a name.",
  routine_name_too_long: () =>
    `Use ${MAX_ROUTINE_NAME_LENGTH} characters or fewer for the routine name.`,
  days_too_many: () => `A routine can have ${MAX_DAYS_PER_ROUTINE} days at most.`,
  weekday_invalid: () => "Pick a day from Monday to Sunday.",
  weekday_repeated: (weekday) =>
    weekday === null
      ? "Only one day can be on each weekday."
      : `Only one day can be on ${describeWeekdayName(weekdayDate(weekday))}.`,
  day_name_blank: () => "Give the day a name.",
  day_name_too_long: () =>
    `Use ${MAX_ROUTINE_DAY_NAME_LENGTH} characters or fewer for the day name.`,
  exercises_too_many: () => `A day can have ${MAX_EXERCISES_PER_ROUTINE_DAY} exercises at most.`,
  target_sets_invalid: () => `Enter sets from ${MIN_TARGET_SETS} to ${MAX_TARGET_SETS}.`,
  rep_min_invalid: () => `Enter the lowest reps from ${MIN_TARGET_REPS} to ${MAX_TARGET_REPS}.`,
  rep_max_invalid: () => `Enter the highest reps from ${MIN_TARGET_REPS} to ${MAX_TARGET_REPS}.`,
  rep_range_inverted: () => "The lowest reps cannot be above the highest.",
  target_rir_invalid: () => `Enter RIR from ${MIN_RIR} to ${MAX_RIR}, or leave it empty.`,
};

/**
 * The sentence for a problem `validateRoutineDraft` found. It states the rule and never the value the
 * person typed. `weekday` is the weekday of the day the problem is on, which only the repeated weekday
 * rule names, and a null weekday gets the sentence without a name.
 */
export const describeRoutineRule = (rule: RoutineDraftRule, weekday: number | null): string =>
  RULE_SENTENCES[rule](weekday);

/**
 * The question asked when the editor is closed with changes. No board draws it (KEY-442 proposes these
 * words, to be drawn by the designers).
 */
export const ROUTINE_DISCARD = {
  title: "Discard changes?",
  body: "What you changed in this routine is lost.",
  discardAction: "Discard changes",
  keepEditingAction: "Keep editing",
} as const;

/**
 * The controls of a day in the editor that no board draws: adding and removing a day, the day's name field
 * and the weekday picker (KEY-442 proposes these words, to be drawn by the designers).
 */
export const ROUTINE_DAY_CONTROLS = {
  addDayAction: "Add day",
  removeDayAction: "Remove day",
  dayNameLabel: "Day name",
  weekdayGroupLabel: "Weekday",
} as const;

/** The weekday sheet's chips: Monday to Sunday by their weekday number, then any day, which is a null weekday. */
export const ROUTINE_WEEKDAY_CHOICES: readonly Readonly<{
  weekday: number | null;
  label: string;
}>[] = [
  ...WEEKDAYS.map((weekday) => ({
    weekday,
    label: describeWeekdayShortName(weekdayDate(weekday)),
  })),
  { weekday: null, label: ANY_WEEKDAY_LABEL },
];

/**
 * The two moves in a day's menu and in an exercise's menu. The boards draw no way to reorder (canvas gap 4,
 * KEY-454 proposes these words, to be drawn by the designers): there is no drag.
 */
export const ROUTINE_MOVE = {
  upAction: "Move up",
  downAction: "Move down",
} as const;

/** The toast when a routine could not be saved, offline or not: the draft is still on the screen. No board draws it. */
export const ROUTINE_SAVE_FAILED = "Your routine did not save, check your connection and try again";

/** The name of the button that opens an exercise's menu: "Options for Barbell squat". */
export const describeExerciseMenuName = (exerciseName: string): string =>
  `Options for ${exerciseName}`;

/** The name of the button that opens a day's menu: "Options for Pull". */
export const describeDayMenuName = (dayName: string): string => `Options for ${dayName}`;

/** The title of the sheet that picks a day's weekday: "Weekday for Pull". */
export const describeWeekdayPickerTitle = (dayName: string): string => `Weekday for ${dayName}`;

/** The accessible name of a day's name field, which tells the fields of two open days apart: "Day name for Pull". */
export const describeDayNameFieldName = (dayName: string): string => `Day name for ${dayName}`;

/** What a screen reader hears while a routine loads for the editor. No board draws the state. */
export const ROUTINE_EDITOR_LOADING_LABEL = "Loading routine";

/** The name a day added to a routine starts with, from its place in the routine: "Day 3". */
export const describeNewDayName = (position: number): string => `Day ${position}`;
