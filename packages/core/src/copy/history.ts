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
import { FINISH_SCREEN } from "./sessionFinish";
import { SET_MARKS, SET_PHRASES } from "./sessionWording";
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

/** The toast when "Load earlier weeks" fails. It states the rule and never a value. No board draws it. */
export const HISTORY_LOAD_EARLIER_FAILED =
  "Earlier weeks did not load, check your connection and try again";

/** The fixed words of the session detail. */
export const HISTORY_SESSION_DETAIL = {
  backLabel: "Back to History",
  moreLabel: "More for this session",
  deleteSessionAction: "Delete session",
  timeLabel: "Time",
  setsLabel: "Sets",
  /** The name of the list of one exercise's sets, for a screen reader. */
  setsListName: "Sets",
} as const;

/** Where the person came from to a session: the history list, or the Train home (its Today card or week strip). */
export type SessionOrigin = "history" | "train";

/** The detail's Back control, named for the screen it goes back to. */
export const describeSessionBackLabel = (origin: SessionOrigin): string =>
  origin === "train" ? HISTORY_SCREEN.backLabel : HISTORY_SESSION_DETAIL.backLabel;

/**
 * The card shown when a session cannot be found: one that does not exist, was deleted or is another
 * person's. The three read alike, so it says none of them. No board draws it.
 */
export const HISTORY_SESSION_NOT_FOUND = {
  title: "Session not found",
  body: "This session is not in your history.",
  action: "Open history",
} as const;

/** The name of the session detail's loading skeleton for a screen reader. No board draws it. */
export const HISTORY_SESSION_LOADING_NAME = "Loading your session";

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
  /** The toast when the delete does not go through. It states the rule and never a value. No board draws it. */
  failed: "The session was not deleted, check your connection and try again",
} as const;

const MINUTES_ABBREVIATION = "min";
const OPEN_SESSION = "open session";
const RESUME_SESSION = "resume session";
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
  /** "51 min · 17 sets". An open session has no minutes yet, so it reads "In progress · 8 sets". */
  meta: string;
  /** Whether the session is open: its row resumes it where the others open their detail. */
  isInProgress: boolean;
  /** "Lats · biceps · mid traps", or null when no muscle worked. */
  muscles: string | null;
  /** "Pull, Tue 13 October, 51 minutes · 17 sets", for a row that opens nothing. An open session adds "in progress". */
  description: string;
  /**
   * The description and "open session": "Pull, Tue 13 October, 51 minutes · 17 sets, open session". An open
   * session says "resume session" instead: "Pull, Tue 13 October, 8 sets, in progress, resume session".
   */
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

/** The name of a control that opens a session, given the name of what it holds: "Pull, Tue 13 October, 51 minutes · 17 sets, open session". */
export const describeOpenSessionName = (name: string): string => `${name}, ${OPEN_SESSION}`;

/** The name of a control that resumes a session, given the name of what it holds: "Pull, Tue 13 October, 8 sets, in progress, resume session". */
export const describeResumeSessionName = (name: string): string => `${name}, ${RESUME_SESSION}`;

/** One session of the list. */
export const describeHistoryRow = ({ localDate, summary }: HistoryRowInput): HistoryRowCopy => {
  const { durationMinutes, workingSets } = summary;
  const name = describeHistorySessionName(summary.titleSource);
  const sets = describeSets(workingSets);
  const isInProgress = durationMinutes === null;
  const minutes = isInProgress
    ? [TRAIN_TODAY_CARD.inProgressLabel]
    : [`${durationMinutes} ${MINUTES_ABBREVIATION}`];
  const spokenMinutes = isInProgress ? [] : [describeCount(durationMinutes, "minute", "minutes")];
  const openState = isInProgress ? [TRAIN_TODAY_CARD.inProgressLabel.toLowerCase()] : [];
  const description = [
    name,
    describeRowDate(localDate),
    [...spokenMinutes, sets].join(SEPARATOR),
    ...openState,
  ].join(", ");
  return {
    weekday: describeWeekdayShortName(localDate),
    dayOfMonth: String(parseCalendarDay(localDate).day),
    name,
    meta: [...minutes, sets].join(SEPARATOR),
    isInProgress,
    muscles: describeMusclesLine(summary.topMuscles),
    description,
    accessibleName: isInProgress
      ? describeResumeSessionName(description)
      : describeOpenSessionName(description),
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
  exercises: SessionStatCopy;
};

/**
 * The three cards under the session detail's title: Time, Sets and Exercises. They state what was done and
 * never compare it with a routine. `exerciseCount` is the exercises the detail lists below, which is every
 * exercise with at least one live set, so an exercise logged with warm-ups alone counts. A free session
 * draws the same three cards.
 */
export const describeSessionStats = (
  summary: SessionSummary,
  exerciseCount: number,
): SessionStatsCopy => {
  const { durationMinutes, workingSets, warmupSets } = summary;
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
    exercises: {
      label: FINISH_SCREEN.exercisesLabel,
      value: String(exerciseCount),
      note: null,
    },
  };
};

export type SessionExerciseNoteInput = Readonly<{
  /** Whether the exercise's sets carry no load. */
  isBodyweight: boolean;
}>;

/** The note beside an exercise's name: "Bodyweight", or null for none. */
export const describeSessionExerciseNote = ({
  isBodyweight,
}: SessionExerciseNoteInput): string | null => (isBodyweight ? "Bodyweight" : null);

export type HistorySetInput = Readonly<{
  setType: SetType;
  /** Its number among the exercise's working sets. Only a working set shows it. */
  setNumber: number;
  /** Null for a set done without a load. */
  loadKg: number | null;
  reps: number;
  /** Null when no RIR was entered. */
  rir: number | null;
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
  /** "Set 3, 70 kg by 10, RIR 2": the name of a row that opens nothing. */
  description: string;
  /** The description and "edit": "Set 3, 70 kg by 10, RIR 2, edit", for a row that opens the edit. */
  accessibleName: string;
};

/** One set of the session detail. */
export const describeHistorySet = ({
  setType,
  setNumber,
  loadKg,
  reps,
  rir,
  unit,
}: HistorySetInput): HistorySetCopy => {
  const loadText = loadKg === null ? null : `${displayLoad(loadKg, unit)} ${unit}`;
  const repsText = describeCount(reps, "rep", "reps");
  const description = [
    SET_PHRASES[setType](setNumber),
    loadText === null ? repsText : `${loadText} by ${reps}`,
    rir === null ? "no RIR" : `RIR ${rir}`,
  ].join(", ");
  return {
    label: SET_MARKS[setType](setNumber),
    what: loadText === null ? repsText : `${loadText} × ${reps}`,
    rir: rir === null ? "No RIR" : `RIR ${rir}`,
    description,
    accessibleName: `${description}, edit`,
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
  /** The sets the question names: the session's working sets, or its warm-ups when it has no others. */
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
