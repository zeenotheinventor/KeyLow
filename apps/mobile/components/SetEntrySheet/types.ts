import type { ExerciseTargetInput } from "@keylow/core/copy";
import type { LoadUnit, SetPrefill, SetType } from "@keylow/core/training";

/** What the exercise's plan asks: its sets, rep range and RIR. */
export type ExercisePlan = NonNullable<ExerciseTargetInput["target"]>;

/** The set the sheet is opened for, and what it opens with. */
export type SetEntryOpening = {
  exerciseId: string;
  exerciseName: string;
  setType: SetType;
  /** Its number among the exercise's working sets. */
  setNumber: number;
  /** The exercise's plan, or null for one added to the session. */
  plan: ExercisePlan | null;
  /** The numbers the fields open with, and where they came from: `prefillNextSet`'s. */
  prefill: SetPrefill;
  /** The same set of the exercise's most recent earlier session, for the line under the fields. */
  lastWeek: Readonly<{ loadKg: number | null; reps: number }> | null;
};

/** The logged set the sheet is opened to change: what it holds now, and what its heading says. */
export type EditSetOpening = {
  /** The exercise's name as the set's snapshot holds it. */
  exerciseName: string;
  setType: SetType;
  /** Its number among the exercise's working sets. */
  setNumber: number;
  /** When the set was performed, an ISO timestamp with a zone. */
  performedAt: string;
  /** The person's IANA time zone: the moment is written in it. */
  tz: string;
  /** The stored load in kilograms, or null for a set done without one. */
  loadKg: number | null;
  reps: number;
  rir: number | null;
};

/** What the person changed on a set: only the fields they touched. The load is in kilograms, to the gram. */
export type SetChanges = {
  loadKg?: number | null;
  reps?: number;
  rir?: number | null;
};

export type SetEntrySheetProps = {
  mode?: "log" | undefined;
  open: boolean;
  /** Called when the set is logged and when the person closes the sheet any other way. */
  onClose: () => void;
  /**
   * Which opening this is, counted up by the screen on every press of a row. The form starts again when it
   * changes, so a form still on its way out never carries its numbers into the next opening.
   */
  openingId: number;
  /** The session in progress, which the set is logged to. */
  sessionId: string;
  /** The unit the person trains in: the load is typed and shown in it, and stored in kilograms. */
  unit: LoadUnit;
  entry: SetEntryOpening;
  /** Opens the set types sheet. The set number at the top is a button only when a screen handles it. */
  onPressSetNumber?: (() => void) | undefined;
};

/** The sheet when it changes a set of a past session (`history · edit-set`): the same fields, with Delete set and Save changes. */
export type EditSetSheetProps = {
  mode: "edit";
  open: boolean;
  /** Called when the change is stored, the set is deleted, nothing was changed, and when the person closes the sheet any other way. */
  onClose: () => void;
  /** Counted up by the screen on every press of a row, so a form still on its way out never carries its numbers into the next opening. */
  openingId: number;
  /** The unit the person trains in: the load is typed and shown in it, and stored in kilograms. */
  unit: LoadUnit;
  entry: EditSetOpening;
  /** Stores the changes. Resolves to whether they were stored: when not, the sheet stays open with the numbers as typed. */
  onSave: (changes: SetChanges) => Promise<boolean>;
  /** Deletes the set. Resolves to whether it was deleted: when not, the sheet stays open. */
  onDelete: () => Promise<boolean>;
};
