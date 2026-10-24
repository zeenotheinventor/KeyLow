import { describeHeatStep, describeSets, joinInWords } from "./bodyMap";
import { describeCount } from "./counts";
import { MUSCLE_NAMES } from "./muscleNames";
import { SET_PHRASES } from "./sessionWording";
import { lowerFirst } from "./wording";
import { formatClockTime } from "../dates/formatClockTime";
import { formatScaledCount } from "../format/scaledCount";
import { characterCount } from "../recipes/characterCount";
import { MAX_SESSION_NOTE_LENGTH } from "../training/bounds";

import type { SetType } from "../training/enums";
import type { MuscleId } from "../training/muscles";
import type { MuscleSessionSets } from "../training/sessionProgress";

/*
 * The words of discarding a session, the set removed toast and the finish screen (KEY-413, canvas version
 * 30), as the boards `session · discard`, `session · set-removed-toast`, `session · finish`,
 * `session · saving`, `session · save-error` and `session · saved-toast` draw them, except where a doc says
 * no board draws a sentence. Data in, sentence out. An exercise name, a count of sets and a note are health
 * data, so none of these throws with one in its message.
 */

/** The fixed words of the discard dialog. */
export const SESSION_DISCARD = {
  title: "Discard this session?",
  confirmAction: "Discard session",
  keepAction: "Keep logging",
} as const;

export type DiscardBodyInput = Readonly<{
  /**
   * The logged sets that are not warm-ups (working, drop and failure), which is the board's "8". The
   * screen passes every logged set only when that count is 0 and warm-ups exist, since discarding removes
   * the warm-ups too.
   */
  setCount: number;
  /** The routine day's name, or null for a session that follows no routine day. */
  dayName: string | null;
}>;

/** The body of the confirmation before a session is discarded. */
export const describeDiscardBody = ({ setCount, dayName }: DiscardBodyInput): string => {
  const subject = dayName ?? "your session";
  const removed = "removed from your history and your body map. This cannot be undone.";
  switch (setCount) {
    case 0:
      return `No sets are logged in ${subject} today. The session is removed. This cannot be undone.`;
    case 1:
      return `The set you logged in ${subject} today is ${removed}`;
    default:
      return `The ${describeSets(setCount)} you logged in ${subject} today are ${removed}`;
  }
};

export type SetRemovedToastInput = Readonly<{
  /** The exercise's name as the catalogue stores it. */
  exerciseName: string;
  setType: SetType;
  /** Its number among the exercise's working sets. Only a working set shows it. */
  setNumber: number;
}>;

/** The toast after a set is removed: "Set removed: Romanian deadlift, set 3". */
export const describeSetRemovedToast = ({
  exerciseName,
  setType,
  setNumber,
}: SetRemovedToastInput): string =>
  `Set removed: ${exerciseName}, ${SET_PHRASES[setType](setNumber).toLowerCase()}`;

/** The fixed words of the finish screen and its toasts. */
export const FINISH_SCREEN = {
  keepLoggingName: "Keep logging",
  timeLabel: "Time",
  setsLabel: "Sets",
  exercisesLabel: "Exercises",
  musclesHeading: "Muscles trained",
  effectiveSetsCaption: "Effective sets",
  figureNames: { front: "This session's heat, front", back: "This session's heat, back" },
  noteLabel: "Note, optional",
  notePlaceholder: "How did it go?",
  saveAction: "Save session",
  savingAction: "Saving session",
  retryAction: "Try again",
  saveFootnote: "Saving updates your body map and this week's sets.",
  saveFailureTitle: "Your session did not save",
  savedToast: "Session saved",
  undoAction: "Undo",
  /** Beside Finish while no set is logged, which is then disabled. The boards do not draw it. */
  nothingLoggedHint: "Log a set or discard this session.",
  /** Under the note past its limit, as a step's is. The boards do not draw it. */
  noteTooLong: `Keep a note to ${formatScaledCount(MAX_SESSION_NOTE_LENGTH)} characters or fewer.`,
} as const;

/** The title: "Finish Legs", or "Finish session" for a session that follows no routine day. */
export const describeFinishTitle = (dayName: string | null): string =>
  `Finish ${dayName ?? "session"}`;

type FinishCardCopy = { value: string; note: string | null };

export type FinishTimeInput = Readonly<{
  minutes: number;
  startedAt: string;
  endedAt: string;
  /** The user's IANA time zone: the clock times are written in it. */
  tz: string;
}>;

/** The Time card: "30 min" with "18:30 to 19:00". */
export const describeFinishTime = ({
  minutes,
  startedAt,
  endedAt,
  tz,
}: FinishTimeInput): FinishCardCopy => ({
  value: `${minutes} min`,
  note: `${formatClockTime(new Date(startedAt), tz)} to ${formatClockTime(new Date(endedAt), tz)}`,
});

export type FinishSetsInput = Readonly<{
  workingSets: number;
  /** The sets the plan asks for. Null, or 0, for a session with no plan. */
  plannedSets: number | null;
  warmups: number;
}>;

/** The Sets card: "8" with "of 16, and 2 warm-ups". */
export const describeFinishSets = ({
  workingSets,
  plannedSets,
  warmups,
}: FinishSetsInput): FinishCardCopy => {
  const planned = plannedSets === null || plannedSets === 0 ? [] : [`of ${plannedSets}`];
  const warmupNote = warmups === 0 ? [] : [`and ${describeCount(warmups, "warm-up", "warm-ups")}`];
  const note = [...planned, ...warmupNote];
  return { value: String(workingSets), note: note.length === 0 ? null : note.join(", ") };
};

export type FinishExercisesInput = Readonly<{
  exercisesLogged: number;
  /** The exercises the plan has. Null, or 0, for a session with no plan. */
  exercisesPlanned: number | null;
}>;

/** The Exercises card: "3" with "of 5 planned". */
export const describeFinishExercises = ({
  exercisesLogged,
  exercisesPlanned,
}: FinishExercisesInput): FinishCardCopy => ({
  value: String(exercisesLogged),
  note:
    exercisesPlanned === null || exercisesPlanned === 0 ? null : `of ${exercisesPlanned} planned`,
});

export type NotLoggedExercise = Readonly<{
  /** The exercise's name as the catalogue stores it. */
  exerciseName: string;
  /** The planned sets of it that are logged. */
  logged: number;
  /** The planned sets of it still to log, at least 1. */
  remaining: number;
}>;

/** The sets left on an exercise that has some logged: "set 3", "sets 2 and 3", "sets 2 to 5". */
const describeSetsLeft = ({ logged, remaining }: NotLoggedExercise): string => {
  const first = logged + 1;
  if (remaining === 1) {
    return `set ${first}`;
  }
  return remaining === 2
    ? `sets ${first} and ${first + 1}`
    : `sets ${first} to ${first + remaining - 1}`;
};

const describeNotLogged = (exercise: NotLoggedExercise): string =>
  exercise.logged === 0
    ? lowerFirst(exercise.exerciseName)
    : `${lowerFirst(exercise.exerciseName)} ${describeSetsLeft(exercise)}`;

/**
 * The note on the finish screen about planned sets left alone: "8 planned sets are not logged: leg press
 * set 3, seated leg curl and standing calf raise. Only logged sets are saved." Null when none are left.
 */
export const describeNotLoggedNote = (exercises: readonly NotLoggedExercise[]): string | null => {
  if (exercises.length === 0) {
    return null;
  }
  const remaining = exercises.reduce((total, exercise) => total + exercise.remaining, 0);
  const count = describeCount(remaining, "planned set", "planned sets");
  const verb = remaining === 1 ? "is" : "are";
  return `${count} ${verb} not logged: ${joinInWords(exercises.map(describeNotLogged))}. Only logged sets are saved.`;
};

/** The rows of the Muscles trained card: the muscle, its name and its effective sets, "5.5 sets". */
export const describeMusclesTrained = (
  rows: readonly MuscleSessionSets[],
): Readonly<{ muscle: MuscleId; name: string; value: string }>[] =>
  rows.map(({ muscle, effectiveSets }) => ({
    muscle,
    name: MUSCLE_NAMES[muscle],
    value: describeSets(effectiveSets),
  }));

export type MuscleTrainedNameInput = Readonly<{
  /** The muscle's name, from `describeMusclesTrained`. */
  name: string;
  /** Its effective sets, from `describeMusclesTrained`: "5.5 sets". */
  value: string;
  /** The heat step of the row's swatch, from 0 to 5. */
  heatStep: number;
}>;

/**
 * The accessible name of a row of the Muscles trained card, which says in words what the swatch shows:
 * "Hamstrings, 5.5 sets, Hot". Throws a `RangeError` naming the rule for a step that is not from 0 to 5.
 */
export const describeMuscleTrainedName = ({
  name,
  value,
  heatStep,
}: MuscleTrainedNameInput): string => `${name}, ${value}, ${describeHeatStep(heatStep)}`;

/** The note counter: "0 / 1,000". Counted in code points, as the database counts them, as typed. */
export const describeNoteLength = (note: string): string =>
  `${formatScaledCount(characterCount(note))} / ${formatScaledCount(MAX_SESSION_NOTE_LENGTH)}`;

/**
 * The line under the failure title: "Your 8 sets are still here. Check your connection, then try again."
 * `setCount` is the logged sets that are not warm-ups (working, drop and failure), the board's "8". The
 * screen passes every logged set only when that count is 0 and warm-ups exist.
 */
export const describeSessionSaveFailure = (setCount: number): string => {
  const what = setCount === 0 ? "session" : setCount === 1 ? "set" : `${setCount} sets`;
  return `Your ${what} ${setCount > 1 ? "are" : "is"} still here. Check your connection, then try again.`;
};
