import { describeRepRange } from "@keylow/core/copy";

import type { RoutineDraftExercise } from "@keylow/core/training";

/** The names of the exercises of a stored routine, by exercise id, for the rows that show them. */
export type ExerciseNames = Readonly<Record<string, string>>;

/** The three fields of an exercise's row. */
export type ExerciseField = "sets" | "reps" | "rir";

/**
 * An exercise of a day with what only the editor needs: a key that stays with the row, the name it shows,
 * and the text of each field as it was typed. The numbers are read from the text each time it changes, and
 * a field that cannot be read is NaN (a missing RIR is null), which is what the checks expect.
 */
export type EditorExercise = RoutineDraftExercise &
  Readonly<{
    /** Stays with the row while exercises come and go, so two rows of one exercise keep their own state. */
    key: number;
    name: string;
    setsText: string;
    repsText: string;
    rirText: string;
  }>;

/** What an exercise starts with when it is added to a day, until the person changes it. */
export const NEW_EXERCISE_TARGETS: Omit<RoutineDraftExercise, "exercise_id"> = {
  target_sets: 3,
  rep_min: 8,
  rep_max: 12,
  target_rir: 2,
};

const DIGITS_ONLY = /\D/g;
// Reps are a number or a range of two, written "8 to 12" or "8-12".
const NOT_REPS_TEXT = /[^\d\sto-]/gi;
const WHOLE_NUMBER = /^\d+$/;
const REP_RANGE = /^(\d+)\s*(?:to|-)\s*(\d*)$/i;

const wholeNumberOf = (text: string): number =>
  WHOLE_NUMBER.test(text) ? Number(text) : Number.NaN;

function repsOf(text: string): Pick<RoutineDraftExercise, "rep_min" | "rep_max"> {
  const trimmed = text.trim();
  if (WHOLE_NUMBER.test(trimmed)) {
    return { rep_min: Number(trimmed), rep_max: Number(trimmed) };
  }
  const range = REP_RANGE.exec(trimmed);
  return {
    rep_min: wholeNumberOf(range?.[1] ?? ""),
    rep_max: wholeNumberOf(range?.[2] ?? ""),
  };
}

/** The exercise as the editor holds it, with its text written as the `routines · editor` board draws it. */
export const editorExerciseOf = (
  exercise: RoutineDraftExercise,
  key: number,
  name: string,
): EditorExercise => ({
  ...exercise,
  key,
  name,
  setsText: String(exercise.target_sets),
  repsText: describeRepRange(exercise.rep_min, exercise.rep_max),
  rirText: exercise.target_rir === null ? "" : String(exercise.target_rir),
});

/** The exercise as core's rules and summary read it: without the editor's key, name and text. */
export const draftExerciseOf = ({
  exercise_id,
  target_sets,
  rep_min,
  rep_max,
  target_rir,
}: EditorExercise): RoutineDraftExercise => ({
  exercise_id,
  target_sets,
  rep_min,
  rep_max,
  target_rir,
});

/**
 * The exercise with one field's text changed, and the numbers read from it again. Only digits are kept (and,
 * for reps, the spaces, hyphen and "to" of a range), and no number is clamped: a number past the bounds is
 * kept as typed for the checks to mark.
 */
export function withFieldText(
  exercise: EditorExercise,
  field: ExerciseField,
  text: string,
): EditorExercise {
  switch (field) {
    case "sets": {
      const setsText = text.replace(DIGITS_ONLY, "");
      return { ...exercise, setsText, target_sets: wholeNumberOf(setsText) };
    }
    case "reps": {
      const repsText = text.replace(NOT_REPS_TEXT, "");
      return { ...exercise, repsText, ...repsOf(repsText) };
    }
    case "rir": {
      const rirText = text.replace(DIGITS_ONLY, "");
      return {
        ...exercise,
        rirText,
        target_rir: rirText === "" ? null : wholeNumberOf(rirText),
      };
    }
  }
}
