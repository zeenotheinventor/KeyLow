import {
  describeMoment,
  describeSets,
  describeWeekdayShortName,
  describeWeekRange,
} from "./bodyMap";
import { describeCount } from "./counts";
import { describeDateInWords } from "./diary";
import { MONTH_NAMES_LONG } from "./diaryDay";
import { MUSCLE_NAMES } from "./muscleNames";
import { TRAIN_TODAY_CARD } from "./train";
import { addCalendarDays, parseCalendarDay } from "../dates/calendarDay";
import { formatClockTime } from "../dates/formatClockTime";
import { displayLoad } from "../training/loads";

import type { SetType } from "../training/enums";
import type { SessionSummary, SessionWeek } from "../training/historySummary";
import type { LoadUnit } from "../training/loads";

/*
 * The words of the history list, the session detail and the edit set sheet, as the boards `history · *` and
 * `HistoryScreen` draw them (KEY-336, canvas version 30), except where a doc says no board draws a
 * sentence. Data in, sentence out: every count, minute, name
 * and date in a sentence comes from the input. A name in a sentence is never logged, so none of these
 * throws with one in its message. An exercise name is written as the catalogue stores it.
 */

/** The fixed words of the History list. */
export const HISTORY_SCREEN = {
  title: "History",
  backLabel: "Back to Train",
  /** No board draws this action. */
  loadEarlierAction: "Load earlier weeks",
} as const;

/** The fixed words of the session detail. */
export const HISTORY_SESSION_DETAIL = {
  backLabel: "Back to History",
  moreLabel: "More for this session",
  deleteSessionAction: "Delete session",
  timeLabel: "Time",
  setsLabel: "Sets",
  planLabel: "Plan",
  /** The name of the list of one exercise's sets, for a screen reader. */
  setsListName: "Sets",
} as const;

/** The card shown when nothing has been logged, ever. */
export const HISTORY_EMPTY = {
  title: "No sessions yet",
  body: "Every session you log shows here, newest first, with its sets.",
  action: "Start a session",
} as const;

/** The name of the loading skeleton for a screen reader. It has nothing else to say. */
export const HISTORY_LOADING_NAME = "Loading your history";

/** The error card. It states the rule and never a value. */
export const HISTORY_ERROR = {
  title: "Your history did not load",
  body: "Your sessions are safe. Check your connection, then try again.",
  action: "Try again",
} as const;

/** The fixed words of the edit set sheet. */
export const HISTORY_EDIT_SET = {
  repsLabel: "Reps",
  rirLabel: "RIR, reps in reserve",
  /** The chips of the RIR choice, the last one standing for six or more. */
  rirOptions: ["0", "1", "2", "3", "4", "5", "6+"],
  /** Shown while the set has no RIR. */
  noRirHint: "Not entered, so this working set counts as hard.",
  effectHint: "Changing a past set updates that day's heat and the week's sets.",
  deleteSetAction: "Delete set",
  saveAction: "Save changes",
} as const;

/** The fixed words of the confirmation before a session is deleted. Its body is `describeDeleteSessionBody`. */
export const HISTORY_DELETE_SESSION = {
  title: "Delete this session?",
  confirmAction: "Delete session",
  cancelAction: "Keep it",
} as const;

const MINUTES_ABBREVIATION = "min";
const SEPARATOR = " · ";
const DAYS_PER_WEEK = 7;

export type HistoryWeekCopy = {
  /** "This week · Mon 12 to Sun 18 Oct". */
  name: string;
  /** "3 sessions · 41 sets". */
  total: string;
};

/**
 * A week's heading and total. The week before `thisWeekStart` is "Last week", and an older week is named by
 * its days alone. Both starts are Mondays, `YYYY-MM-DD`.
 */
export const describeHistoryWeek = (
  {
    weekStart,
    sessionCount,
    workingSetTotal,
  }: Pick<SessionWeek, "weekStart" | "sessionCount" | "workingSetTotal">,
  thisWeekStart: string,
): HistoryWeekCopy => {
  const range = describeWeekRange(weekStart);
  const lead =
    weekStart === thisWeekStart
      ? "This week"
      : addCalendarDays(weekStart, DAYS_PER_WEEK) === thisWeekStart
        ? "Last week"
        : null;
  return {
    name: lead === null ? range : `${lead}${SEPARATOR}${range}`,
    total: `${describeCount(sessionCount, "session", "sessions")}${SEPARATOR}${describeSets(workingSetTotal)}`,
  };
};

/** A session's name: the routine day's, or Session for one that follows no routine day, as the Train home names it. */
export const describeHistorySessionName = (titleSource: string | null): string =>
  titleSource ?? TRAIN_TODAY_CARD.sessionName;

export type HistoryRowInput = Readonly<{
  /** The calendar day the session started, `YYYY-MM-DD`. */
  localDate: string;
  summary: SessionSummary;
}>;

export type HistoryRowCopy = {
  /** The date block's top line: "Tue". */
  weekday: string;
  /** The date block's bottom line: "13". */
  dayOfMonth: string;
  /** "Pull". */
  name: string;
  /** "51 min · 17 sets". An open session has no minutes yet, so it reads "8 sets". */
  meta: string;
  /** "Lats · biceps · mid traps", or null when no muscle worked. */
  muscles: string | null;
  /** "Pull, Tue 13 October, 51 minutes · 17 sets, open session". An open session adds "in progress" before the link hint. */
  accessibleName: string;
};

const describeMusclesLine = (muscles: SessionSummary["topMuscles"]): string | null =>
  muscles.length === 0
    ? null
    : muscles
        .map((muscle, index) =>
          index === 0 ? MUSCLE_NAMES[muscle] : MUSCLE_NAMES[muscle].toLowerCase(),
        )
        .join(SEPARATOR);

const describeRowDate = (localDate: string): string => {
  const { month, day } = parseCalendarDay(localDate);
  return `${describeWeekdayShortName(localDate)} ${day} ${MONTH_NAMES_LONG[month - 1]}`;
};

/** One session of the list. */
export const describeHistoryRow = ({ localDate, summary }: HistoryRowInput): HistoryRowCopy => {
  const { durationMinutes, workingSets } = summary;
  const name = describeHistorySessionName(summary.titleSource);
  const sets = describeSets(workingSets);
  const minutes = durationMinutes === null ? [] : [`${durationMinutes} ${MINUTES_ABBREVIATION}`];
  const spokenMinutes =
    durationMinutes === null ? [] : [describeCount(durationMinutes, "minute", "minutes")];
  const openState =
    durationMinutes === null ? [TRAIN_TODAY_CARD.inProgressLabel.toLowerCase()] : [];
  return {
    weekday: describeWeekdayShortName(localDate),
    dayOfMonth: String(parseCalendarDay(localDate).day),
    name,
    meta: [...minutes, sets].join(SEPARATOR),
    muscles: describeMusclesLine(summary.topMuscles),
    accessibleName: [
      name,
      describeRowDate(localDate),
      [...spokenMinutes, sets].join(SEPARATOR),
      ...openState,
      "open session",
    ].join(", "),
  };
};

export type SessionWhenInput = Readonly<{
  /** The calendar day the session started, `YYYY-MM-DD`. */
  localDate: string;
  startedAt: string;
  /** Null while the session is open. */
  endedAt: string | null;
  /** The user's IANA time zone: the clock times are written in it. */
  tz: string;
}>;

/** The line under the session detail's title: "Tuesday 13 October · 18:00 to 18:51". An open session gives its start alone. */
export const describeSessionWhen = ({
  localDate,
  startedAt,
  endedAt,
  tz,
}: SessionWhenInput): string => {
  const start = formatClockTime(new Date(startedAt), tz);
  const times = endedAt === null ? start : `${start} to ${formatClockTime(new Date(endedAt), tz)}`;
  return `${describeDateInWords(localDate)}${SEPARATOR}${times}`;
};

export type SessionStatCopy = {
  label: string;
  value: string;
  note: string | null;
};

export type SessionStatsCopy = {
  time: SessionStatCopy;
  sets: SessionStatCopy;
  /** Null for a session that follows no routine day, since it has no plan to compare with. */
  plan: SessionStatCopy | null;
};

const describePlanStat = (comparison: NonNullable<SessionSummary["planComparison"]>) => {
  const setsOver = comparison.setsOverPlan.reduce((total, { setsOver: over }) => total + over, 0);
  const notLogged = comparison.exercisesNotLogged.length;
  if (setsOver > 0) {
    return { value: `+${setsOver}`, note: setsOver === 1 ? "set over" : "sets over" };
  }
  if (notLogged > 0) {
    return {
      value: "Under",
      note: `${describeCount(notLogged, "exercise", "exercises")} not logged`,
    };
  }
  return { value: "On plan", note: null };
};

/**
 * The three cards under the session detail's title. The Plan card shows the sets over the plan when
 * there are any, then the exercises not logged, then that the session was on plan.
 */
export const describeSessionStats = (summary: SessionSummary): SessionStatsCopy => {
  const { durationMinutes, workingSets, warmupSets, planComparison } = summary;
  return {
    time: {
      label: HISTORY_SESSION_DETAIL.timeLabel,
      value:
        durationMinutes === null
          ? TRAIN_TODAY_CARD.inProgressLabel
          : `${durationMinutes} ${MINUTES_ABBREVIATION}`,
      note: null,
    },
    sets: {
      label: HISTORY_SESSION_DETAIL.setsLabel,
      value: String(workingSets),
      note: warmupSets === 0 ? null : `and ${describeCount(warmupSets, "warm-up", "warm-ups")}`,
    },
    plan:
      planComparison === null
        ? null
        : { label: HISTORY_SESSION_DETAIL.planLabel, ...describePlanStat(planComparison) },
  };
};

export type SessionExerciseNoteInput = Readonly<{
  /** Whether the exercise's sets carry no load. */
  isBodyweight: boolean;
  /** The sets logged beyond the plan's target, 0 for none. */
  setsOver: number;
}>;

/** The note beside an exercise's name: "Bodyweight", "2 more than planned", both, or null for neither. */
export const describeSessionExerciseNote = ({
  isBodyweight,
  setsOver,
}: SessionExerciseNoteInput): string | null => {
  const notes = [
    ...(isBodyweight ? ["Bodyweight"] : []),
    ...(setsOver > 0 ? [`${setsOver} more than planned`] : []),
  ];
  return notes.length === 0 ? null : notes.join(SEPARATOR);
};

/** What a set is called on a row and in the sheet, given its number among the working sets. */
const SET_PHRASES: Record<SetType, (setNumber: number) => string> = {
  warmup: () => "Warm-up set",
  working: (setNumber) => `Set ${setNumber}`,
  drop: () => "Drop set",
  failure: () => "Failure set",
};

/** The mark at the start of a set's row, as the session set types board draws them. */
const SET_MARKS: Record<SetType, (setNumber: number) => string> = {
  warmup: () => "W",
  working: (setNumber) => String(setNumber),
  drop: () => "D",
  failure: () => "F",
};

export type HistorySetInput = Readonly<{
  setType: SetType;
  /** Its number among the exercise's working sets. Only a working set shows it. */
  setNumber: number;
  /** Null for a set done without a load. */
  loadKg: number | null;
  reps: number;
  /** Null when no RIR was entered. */
  rir: number | null;
  /** Whether the set is beyond what the plan targets for the exercise. */
  isNotInPlan: boolean;
  /** The unit the person trains in. */
  unit: LoadUnit;
}>;

export type HistorySetCopy = {
  /** "W", "1", "D" or "F". */
  label: string;
  /** "70 kg × 10", or "10 reps" for a set with no load. */
  what: string;
  /** "RIR 2" or "No RIR". */
  rir: string;
  /** "Set 3, 70 kg by 10, RIR 2, edit". */
  accessibleName: string;
};

/** One set of the session detail. */
export const describeHistorySet = ({
  setType,
  setNumber,
  loadKg,
  reps,
  rir,
  isNotInPlan,
  unit,
}: HistorySetInput): HistorySetCopy => {
  const loadText = loadKg === null ? null : `${displayLoad(loadKg, unit)} ${unit}`;
  const repsText = describeCount(reps, "rep", "reps");
  return {
    label: SET_MARKS[setType](setNumber),
    what: loadText === null ? repsText : `${loadText} × ${reps}`,
    rir: rir === null ? "No RIR" : `RIR ${rir}`,
    accessibleName: [
      SET_PHRASES[setType](setNumber),
      loadText === null ? repsText : `${loadText} by ${reps}`,
      rir === null ? "no RIR" : `RIR ${rir}`,
      ...(isNotInPlan ? ["not in the plan"] : []),
      "edit",
    ].join(", "),
  };
};

export type EditSetSheetInput = Readonly<{
  /** The exercise's name as the catalogue stores it: "Barbell Curl". */
  exerciseName: string;
  setType: SetType;
  /** Its number among the exercise's working sets. Only a working set shows it. */
  setNumber: number;
  /** When the set was performed, an ISO timestamp with a zone. */
  performedAt: string;
  /** The user's IANA time zone: the moment is written in it. */
  tz: string;
}>;

export type EditSetSheetCopy = {
  /** "Edit Barbell Curl, set 3". */
  accessibleName: string;
  /** "Barbell Curl". */
  title: string;
  /** "Set 3 · Tue 13 Oct, 18:51". */
  subtitle: string;
};

/** The sheet's heading words. */
export const describeEditSetSheet = ({
  exerciseName,
  setType,
  setNumber,
  performedAt,
  tz,
}: EditSetSheetInput): EditSetSheetCopy => {
  const phrase = SET_PHRASES[setType](setNumber);
  return {
    accessibleName: `Edit ${exerciseName}, ${phrase.toLowerCase()}`,
    title: exerciseName,
    subtitle: `${phrase}${SEPARATOR}${describeMoment(performedAt, tz)}`,
  };
};

/** The load field's label: "Load, kg". */
export const describeLoadFieldLabel = (unit: LoadUnit): string => `Load, ${unit}`;

export type DeleteSessionInput = Readonly<{
  /** Every live set the session holds, warm-ups included, since they all go with it. */
  setCount: number;
  /** The routine day's name, or null for a session that follows no routine day. */
  dayName: string | null;
  /** The calendar day the session started, `YYYY-MM-DD`. */
  localDate: string;
}>;

/** The body of the confirmation before a session is deleted. */
export const describeDeleteSessionBody = ({
  setCount,
  dayName,
  localDate,
}: DeleteSessionInput): string => {
  const date = describeDateInWords(localDate);
  const removed = "removed from your history and your body map. This cannot be undone.";
  const subject = dayName ?? "your session";
  switch (setCount) {
    case 0:
      return `The session on ${date} is ${removed}`;
    case 1:
      return `The set in ${subject} on ${date} is ${removed}`;
    default:
      return `The ${describeSets(setCount)} in ${subject} on ${date} are ${removed}`;
  }
};
