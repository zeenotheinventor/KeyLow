import type { ExercisePlan } from "../SetEntrySheet";
import type { SessionSet } from "@keylow/api-client";
import type { LoadUnit, SessionExercise } from "@keylow/core/training";

export type SessionScreenProps = {
  /** Hides the screen and leaves the session running: the control named "Hide session, it keeps running". */
  onHide: () => void;
  /**
   * Called once the session is discarded: the screen then goes on to the tabs. The header's More control
   * is drawn only when it is given, so none is a dead control.
   */
  onDiscarded?: (() => void) | undefined;
};

/** One exercise card of the session: who it is and how it is planned, with its rows. */
export type SessionScreenExercise = {
  name: string;
  /** The line under the name: "3 × 10 to 12 · RIR 1 · Machine". */
  target: string;
  /** The plan's sets, rep range and RIR for the exercise, or null for one added to the session. */
  plan: ExercisePlan | null;
  exercise: SessionExercise<SessionSet>;
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
      sets: readonly SessionSet[];
      exercises: readonly SessionScreenExercise[];
    };
