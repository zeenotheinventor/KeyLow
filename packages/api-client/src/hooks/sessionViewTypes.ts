import type { SessionSet } from "../repos/trainingSchemas";
import type { ExerciseTargetInput } from "@keylow/core/copy";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";
import type {
  Equipment,
  LoadUnit,
  PlanProgress,
  SessionExercise,
  SetType,
  SetValues,
} from "@keylow/core/training";

/**
 * A set of the session as a screen draws it: one the database holds, or one being saved, which has no
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

/** What the exercise's plan asks: its sets, rep range and RIR. */
export type ExercisePlan = NonNullable<ExerciseTargetInput["target"]>;

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

/** What a card does when a check is pressed. */
export type SetLogging = {
  logSet: (request: LogSetRequest) => void;
  removeSet: (request: RemoveSetRequest) => void;
  /** Whether a set is one still being saved, whose check does nothing until the database has stored it. */
  isSaving: (setId: string) => boolean;
};

/**
 * An exercise added to the session that has no logged set yet. The data model stores sets, not exercises,
 * so until its first set is logged it is held only on this device, with the name and equipment its card needs.
 */
export type AddedExercise = { id: string; name: string; equipment: Equipment };

/** One exercise card of the session: who it is and how it is planned, with its rows. */
export type SessionViewExercise = {
  name: string;
  /** The line under the name: "3 × 10 to 12 · RIR 1 · Machine". */
  target: string;
  /** The plan's sets, rep range and RIR for the exercise, or null for one added to the session. */
  plan: ExercisePlan | null;
  /**
   * The exercise's muscle map as the device holds it: the snapshot of a set already saved, else the active
   * routine's current map, else null (an exercise added on screen with no set saved yet).
   */
  muscles: readonly ExerciseMuscleEntry[] | null;
  exercise: SessionExercise<ScreenSet>;
};

/** The exercise a plan names, which every exercise of the plan's day has. */
export type PlannedExerciseName = Readonly<{ exerciseId: string; name: string }>;

/** What a session screen has read. */
export type SessionView =
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
      exercises: readonly SessionViewExercise[];
      /** Puts a card for the picked exercise on the screen, with one row to do. It exists on screen only until its first set is logged. */
      addExercise: (exercise: AddedExercise) => void;
      /** The sets against the plan, which the finish screen reads. */
      progress: PlanProgress;
      /** The plan's exercises by name, or null for a session that follows no routine day. */
      plannedNames: readonly PlannedExerciseName[] | null;
    };
