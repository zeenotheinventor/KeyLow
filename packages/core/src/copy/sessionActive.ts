import { EQUIPMENT_OPTIONS } from "./goals";
import {
  SET_MARKS,
  SET_PHRASES,
  UNIT_WORDS,
  spokenNumbers,
  writtenNumbers,
} from "./sessionWording";
import { describePlannedExerciseTarget } from "./train";
import { displayLoad } from "../training/loads";

import type { Equipment, SetType } from "../training/enums";
import type { LoadUnit } from "../training/loads";

/*
 * The words of the active session screen (KEY-413, canvas version 30), as the boards `session · active`,
 * `session · from-routine` and `session · lb` draw them, except where a doc says no board draws a sentence.
 * Data in, sentence out. A load, a count of reps and an exercise name are health data, so none of these
 * throws with one in its message.
 */

const SEPARATOR = " · ";
const NOT_ENTERED = "–";

/** The fixed words of the active session screen. */
export const SESSION_ACTIVE = {
  finishAction: "Finish",
  hideSessionName: "Hide session, it keeps running",
  addSetAction: "Add set",
  addExerciseAction: "Add exercise",
  /** The accessible name of an exercise's list of set rows. */
  setsListName: "Sets",
  /** The heading of the column that holds the check, which a table keeps for a screen reader alone. */
  loggedColumnName: "Logged",
} as const;

export type SetColumnsCopy = {
  set: string;
  previous: string;
  /** The unit the person trains in: "kg" or "lb". */
  load: string;
  reps: string;
  rir: string;
};

/** The column headings above an exercise's set rows. */
export const describeSetColumns = (unit: LoadUnit): SetColumnsCopy => ({
  set: "Set",
  previous: "Previous",
  load: unit,
  reps: "Reps",
  rir: "RIR",
});

export type SetCellNameInput = Readonly<{
  exerciseName: string;
  setType: SetType;
  /** Its number among the exercise's working sets. A warm-up has none. */
  setNumber: number;
  unit: LoadUnit;
  column: "load" | "reps" | "rir";
}>;

/** The name of one field of a set's row, for a screen where the row's cells are fields: "Leg press, set 3, kilograms". */
export const describeSetCellName = ({
  exerciseName,
  setType,
  setNumber,
  unit,
  column,
}: SetCellNameInput): string => {
  const columnWords = { load: UNIT_WORDS[unit].plural, reps: "reps", rir: "RIR" }[column];
  return `${exerciseName}, ${SET_PHRASES[setType](setNumber).toLowerCase()}, ${columnWords}`;
};

/** The name of an exercise's more button: "More for Leg press". */
export const describeMoreForExercise = (exerciseName: string): string => `More for ${exerciseName}`;

export type ExerciseTargetInput = Readonly<{
  /** The plan's sets, reps and RIR for the exercise, or null for one added to the session. */
  target: Readonly<{
    sets: number;
    repMin: number;
    repMax: number;
    /** Null when the plan sets no RIR. */
    rir: number | null;
  }> | null;
  equipment: Equipment;
}>;

/** The line under an exercise's name: "3 × 10 to 12 · RIR 1 · Machine". */
export const describeExerciseTarget = ({ target, equipment }: ExerciseTargetInput): string =>
  [
    ...(target === null ? [] : [describePlannedExerciseTarget(target)]),
    EQUIPMENT_OPTIONS[equipment].label,
  ].join(SEPARATOR);

export type SetRowEntry =
  /** A set that is logged. */
  | Readonly<{ state: "logged"; loadKg: number | null; reps: number; rir: number | null }>
  /** The next set, with the numbers the entry would open with, not yet logged. */
  | Readonly<{ state: "ready"; loadKg: number | null; reps: number }>
  /** A set still to come. */
  | Readonly<{ state: "empty" }>;

export type SetRowInput = Readonly<{
  setType: SetType;
  /** Its number among the exercise's working sets. Only a working set shows it. */
  setNumber: number;
  unit: LoadUnit;
  /** The same set in the exercise's most recent earlier session, or null when there is none. */
  previous: Readonly<{ loadKg: number | null; reps: number }> | null;
  entry: SetRowEntry;
}>;

export type SetRowCopy = {
  /** "W", "3", "D" or "F". */
  label: string;
  /** "170 × 12", or a dash. */
  previous: string;
  load: string;
  reps: string;
  rir: string;
  /** "Set 3 logged, 180 kilograms, 11 reps, RIR 1, undo". */
  accessibleName: string;
};

const describeSetRowName = ({ setType, setNumber, unit, entry }: SetRowInput): string => {
  const phrase = SET_PHRASES[setType](setNumber);
  switch (entry.state) {
    case "logged":
      return [`${phrase} logged`, ...spokenNumbers(entry, unit), "undo"].join(", ");
    case "ready":
      return [`Log ${phrase.toLowerCase()}`, ...spokenNumbers(entry, unit)].join(", ");
    case "empty":
      return `Log ${phrase.toLowerCase()}`;
  }
};

/** One set of an exercise: the cells of its row and the accessible name of its check. */
export const describeSetRow = (input: SetRowInput): SetRowCopy => {
  const { setType, setNumber, unit, previous, entry } = input;
  const hasNumbers = entry.state !== "empty";
  return {
    label: SET_MARKS[setType](setNumber),
    previous: previous === null ? NOT_ENTERED : writtenNumbers(previous, unit, ""),
    load: hasNumbers && entry.loadKg !== null ? displayLoad(entry.loadKg, unit) : NOT_ENTERED,
    reps: hasNumbers ? String(entry.reps) : NOT_ENTERED,
    rir: entry.state === "logged" && entry.rir !== null ? String(entry.rir) : NOT_ENTERED,
    accessibleName: describeSetRowName(input),
  };
};
