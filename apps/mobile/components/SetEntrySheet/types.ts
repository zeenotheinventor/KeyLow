import type { ExerciseTargetInput } from "@keylow/core/copy";
import type { LoadUnit, SetDraft, SetPrefill, SetType } from "@keylow/core/training";

/** What the exercise's plan asks: its sets, rep range and RIR. */
export type ExercisePlan = NonNullable<ExerciseTargetInput["target"]>;

/** The set the sheet is opened for, and what it opens with. */
export type SetEntryOpening = {
  exerciseId: string;
  exerciseName: string;
  /** The slot's own type, which the screen's chosen type starts as. */
  setType: SetType;
  /** Its number among the exercise's working sets, or the one it would have as one. */
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

/** A set to store, as the form holds it: the text of its numbers and the unit the load was typed in. */
export type SetLogRequest = {
  draft: SetDraft;
  unit: LoadUnit;
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
  /**
   * The type the set will be logged with, held by the screen beside the opening: it starts as the slot's own
   * type (`entry.setType`). The control and the set types sheet the set number opens both change it through
   * `onChangeSetType`. The screen must not count up `openingId` for a change, or the typed numbers are lost.
   */
  setType: SetType;
  onChangeSetType: (setType: SetType) => void;
  /** Opens the set types sheet. The set number at the top is a button only when a screen handles it. */
  onPressSetNumber?: (() => void) | undefined;
  /**
   * Stores the set in place of the sheet's own write to the session in progress, for a session that is not
   * the one in progress. Resolves to whether it was stored: when not, the sheet stays open with the numbers as
   * typed, and the screen has said so. Without it the sheet logs to `sessionId` itself.
   */
  onLogSet?: ((request: SetLogRequest) => Promise<boolean>) | undefined;
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
