import { describeLongDate } from "./assistantDayCards";
import { joinInWords } from "./bodyMap";
import { EQUIPMENT_OPTIONS } from "./goals";
import { MUSCLE_NAMES } from "./muscleNames";
import { SET_PHRASES, writtenNumbers } from "./sessionWording";
import { MUSCLE_IDS } from "../training/muscles";

import type { Equipment, MuscleRole } from "../training/enums";
import type { LoadUnit } from "../training/loads";
import type { MuscleId } from "../training/muscles";
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

// KEY-905: custom exercises

/** One muscle of a custom exercise, as a card is worded from it. */
export type ExerciseCardMuscle = { muscle_id: MuscleId; role: MuscleRole };

const ROLE_ORDER: readonly MuscleRole[] = ["primary", "secondary", "stabiliser"];

/**
 * "Abs, obliques": the muscles of an exercise, the primary ones first, then the secondary and the
 * assisting ones, each group in the order of the muscle list. Only the first is capitalised, as the
 * board writes it.
 */
export const describeExerciseMuscles = (muscles: readonly ExerciseCardMuscle[]): string =>
  ROLE_ORDER.flatMap((role) =>
    muscles
      .filter((muscle) => muscle.role === role)
      .sort(
        (first, second) =>
          MUSCLE_IDS.indexOf(first.muscle_id) - MUSCLE_IDS.indexOf(second.muscle_id),
      ),
  )
    .map(({ muscle_id }, index) =>
      index === 0 ? MUSCLE_NAMES[muscle_id] : MUSCLE_NAMES[muscle_id].toLowerCase(),
    )
    .join(", ");

/** Where an exercise is done, for the line shown once an edit is undone. Only the cable is on the canvas. */
const EQUIPMENT_PLACES: Readonly<Record<Equipment, string>> = {
  barbell: "with a barbell",
  dumbbell: "with dumbbells",
  kettlebell: "with a kettlebell",
  cable: "on the cable",
  machine: "on the machine",
  smith_machine: "on the Smith machine",
  ez_bar: "with an EZ bar",
  band: "with a band",
  bodyweight: "with bodyweight",
  other: "with other equipment",
};

/** "Custom · Cable · Abs", under the title of an added exercise. */
export const describeExerciseCreatedSub = (
  equipment: Equipment,
  muscles: readonly ExerciseCardMuscle[],
): string => `Custom · ${EQUIPMENT_OPTIONS[equipment].label} · ${describeExerciseMuscles(muscles)}`;

/** "Added exercise Cable crunch". */
export const describeExerciseCreatedTitle = (name: string): string => `Added exercise ${name}`;

/** The note under an added exercise: it is not in a routine yet, and nothing links to it. */
export const EXERCISE_CREATED_NOTE =
  "Not in a routine yet. Say which day, or add it in the routine editor.";

/** The line under "Undone" for an added exercise: "Archived Cable crunch". */
export const describeExerciseCreatedUndone = (name: string): string => `Archived ${name}`;

/** "Updated exercise Kneeling cable crunch". */
export const describeExerciseUpdatedTitle = (name: string): string => `Updated exercise ${name}`;

export const EXERCISE_UPDATED_NOTE = "Sets you already logged keep what they were.";

/** The names of the rows of an edit, one for each field that changed. */
export const EXERCISE_UPDATED_ROWS = {
  name: "Name",
  /** NOT ON THE CANVAS: the board draws a rename and a muscle change only. */
  equipment: "Equipment",
  muscles: "Muscles",
} as const;

/** "Was Cable crunch". */
export const describeExerciseWasName = (name: string): string => `Was ${name}`;

/** NOT ON THE CANVAS: "Machine · was Cable", in the way of the muscles row. */
export const describeExerciseEquipmentChange = (now: Equipment, was: Equipment): string =>
  `${EQUIPMENT_OPTIONS[now].label} · was ${EQUIPMENT_OPTIONS[was].label}`;

/** "Abs, obliques · was Abs". */
export const describeExerciseMusclesChange = (
  now: readonly ExerciseCardMuscle[],
  was: readonly ExerciseCardMuscle[],
): string => `${describeExerciseMuscles(now)} · was ${describeExerciseMuscles(was)}`;

/**
 * "Put back Cable crunch, on the cable, for abs": the line under "Undone" for an edit, with "for abs and
 * obliques" for two muscles and "for abs, obliques and calves" for three. The phrase for any equipment but
 * the cable is NOT ON THE CANVAS.
 */
export const describeExerciseUpdatedUndone = (
  name: string,
  equipment: Equipment,
  muscles: readonly ExerciseCardMuscle[],
): string =>
  `Put back ${name}, ${EQUIPMENT_PLACES[equipment]}, for ${joinInWords(describeExerciseMuscles(muscles).toLowerCase().split(", "))}`;

/** "Archived exercise Cable crunch". */
export const describeExerciseArchivedTitle = (name: string): string => `Archived exercise ${name}`;

export const EXERCISE_ARCHIVED_SUB = "Sets you logged with it stay in your history";

/** The line under "Undone" for an archived exercise: "Cable crunch is back in your exercises". */
export const describeExerciseArchivedUndone = (name: string): string =>
  `${name} is back in your exercises`;

/** The archive confirmation: the question is the model's own words, and these are its two buttons. */
export const CONFIRM_ARCHIVE_EXERCISE_BUTTONS = {
  confirm: "Archive exercise",
  cancel: "Keep it",
};

/** "Archive Cable crunch? It leaves your exercise list. Sets you logged with it stay in your history." */
export const describeConfirmArchiveExerciseQuestion = (name: string): string =>
  `Archive ${name}? It leaves your exercise list. ${EXERCISE_ARCHIVED_SUB}.`;

/** The words for the model when an exercise is on a routine that is not archived. Follows the routine refusals'. */
export const EXERCISE_IN_ROUTINE_REFUSAL = "Take it out of your routines first.";

/** NOT ON THE CANVAS: the words when a live accepted suggestion names the exercise. */
export const EXERCISE_IN_SUGGESTION_REFUSAL =
  "It is in a workout you accepted on Train. Undo that first.";
