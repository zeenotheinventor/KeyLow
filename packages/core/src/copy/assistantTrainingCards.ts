import { EQUIPMENT_OPTIONS } from "./goals";
import { MUSCLE_NAMES } from "./muscleNames";
import { MUSCLE_IDS } from "../training/muscles";

import type { Equipment, MuscleRole } from "../training/enums";
import type { MuscleId } from "../training/muscles";

/*
 * The words of the assistant's training cards, from the approved canvas "Ki-Lo assistant screens"
 * (assistant-card exercise-created, exercise-updated and exercise-archived, assistant confirm-training). A
 * string marked NOT ON THE CANVAS is a draft in the board's style that the designers have not drawn, and
 * waits for Zee's approval. Each training write adds its own block under a heading of its ticket.
 */

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

/** NOT ON THE CANVAS: the card is not in a routine, and nothing links to the exercise. */
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
 * "Put back Cable crunch, on the cable, for abs": the line under "Undone" for an edit. The phrase for any
 * equipment but the cable is NOT ON THE CANVAS.
 */
export const describeExerciseUpdatedUndone = (
  name: string,
  equipment: Equipment,
  muscles: readonly ExerciseCardMuscle[],
): string =>
  `Put back ${name}, ${EQUIPMENT_PLACES[equipment]}, for ${describeExerciseMuscles(muscles).toLowerCase()}`;

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
