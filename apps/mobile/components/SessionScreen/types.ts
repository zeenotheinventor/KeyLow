import type { ChosenExercise } from "../AddExerciseSheet";
import type { FinishDetails, SavedOutcome } from "../FinishScreen";
import type { ExercisePlan } from "../SetEntrySheet";
import type { SessionSet } from "@keylow/api-client";
import type {
  Equipment,
  LoadUnit,
  SessionExercise,
  SetType,
  SetValues,
} from "@keylow/core/training";

export type SessionScreenProps = {
  /** Hides the screen and leaves the session running: the control named "Hide session, it keeps running". */
  onHide: () => void;
  /**
   * Called once the session is discarded: the screen then goes on to the tabs. The header's More control
   * is drawn only when it is given, so none is a dead control.
   */
  onDiscarded?: (() => void) | undefined;
  /**
   * Called once the session is saved. The route shows the Session saved toast and, when the screen is
   * still open, goes on to the tabs: nothing is left to show, since the session is no longer the one in
   * progress. A save that lands after the screen closed still calls it, with `isScreenOpen` false.
   */
  onFinished: (outcome: SavedOutcome) => void;
};

/**
 * A set of the session as the screen draws it: one the database holds, or one being saved, which has no
 * snapshot yet (its exercise's name comes from the plan or from the exercise's stored sets).
 */
export type ScreenSet = Omit<SessionSet, "snapshot"> & {
  snapshot?: SessionSet["snapshot"] | undefined;
};

/**
 * A set that is on its way to the database. `savedId` is the id the database gave it once it has stored
 * it, kept so the set is hidden the moment the session read holds the stored one, and drawn until then.
 */
export type PendingSet = Readonly<{ set: ScreenSet; savedId: string | null }>;

export type PendingSets = {
  sets: readonly PendingSet[];
  add: (set: ScreenSet) => void;
  /** Records the id the database gave a pending set. */
  markSaved: (pendingId: string, savedId: string) => void;
  /** Takes a pending set back out, as when it failed to save. */
  drop: (pendingId: string) => void;
  /** Takes out the pending sets the stored sets now hold. */
  prune: (storedIds: ReadonlySet<string>) => void;
};

/** Logs a set from the values a row shows. */
export type LogSetRequest = {
  exerciseId: string;
  values: SetValues;
};

/** Removes a logged set, for the toast "Set removed: Romanian deadlift, set 3". */
export type RemoveSetRequest = {
  setId: string;
  exerciseName: string;
  setType: SetType;
  setNumber: number;
};

/** The logged set the set types sheet is opened for: who it is, and the number it has among the working sets or would have as one. */
export type SetTypeOpening = {
  setId: string;
  exerciseName: string;
  setType: SetType;
  setNumber: number;
};

/** Changes the type of a logged set. */
export type ChangeSetTypeRequest = {
  setId: string;
  setType: SetType;
};

/** What a card does when a check is pressed. */
export type SetLogging = {
  logSet: (request: LogSetRequest) => void;
  removeSet: (request: RemoveSetRequest) => void;
  /** Whether a set is one still being saved, whose check does nothing until the database has stored it. */
  isSaving: (setId: string) => boolean;
};

/** One exercise card of the session: who it is and how it is planned, with its rows. */
export type SessionScreenExercise = {
  name: string;
  /** The line under the name: "3 × 10 to 12 · RIR 1 · Machine". */
  target: string;
  /** The plan's sets, rep range and RIR for the exercise, or null for one added to the session. */
  plan: ExercisePlan | null;
  exercise: SessionExercise<ScreenSet>;
};

/** What the screen has read. */
export type SessionScreenView =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "none" }
  | {
      status: "ready";
      sessionId: string;
      /** What the header's clock works from. The time itself is the header's own. */
      header: {
        dayName: string | null;
        startedAt: string;
        endedAt: string | null;
        setsLogged: number;
        setsPlanned: number;
      };
      unit: LoadUnit;
      sets: readonly ScreenSet[];
      exercises: readonly SessionScreenExercise[];
      /** Puts a card for the picked exercise on the screen, with one row to do. It exists on screen only until its first set is logged. */
      addExercise: (exercise: ChosenExercise) => void;
      /** What the finish screen shows, as it stands now. */
      finish: FinishDetails;
    };

/**
 * An exercise added to the session that has no logged set yet. The data model stores sets, not exercises,
 * so until its first set is logged it is held only on this phone, with the name and equipment its card needs.
 */
export type AddedExercise = { id: string; name: string; equipment: Equipment };
