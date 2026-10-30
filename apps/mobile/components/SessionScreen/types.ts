import type { FinishDetails, SavedOutcome } from "../FinishScreen";
import type { SessionView } from "@keylow/api-client";
import type { SetType } from "@keylow/core/training";

export type {
  LogSetRequest,
  PendingSet,
  PendingSets,
  RemoveSetRequest,
  ScreenSet,
  SetLogging,
} from "@keylow/api-client";

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

/** What the screen has read: the shared view, and for a ready session what the finish screen shows as it stands now. */
export type SessionScreenView =
  | Exclude<SessionView, { status: "ready" }>
  | (Extract<SessionView, { status: "ready" }> & { finish: FinishDetails });
