import { describeLongDate } from "./assistantDayCards";
import { SET_PHRASES, writtenNumbers } from "./sessionWording";

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
