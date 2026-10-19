import type { ArchivedRoutineItem, RoutineRef } from "../RoutinesView";

/**
 * The archived routines, which may be none, or, for a list that is not there yet, a loading or failed
 * state. Restore is drawn only when `onRestore` is given, so it is no dead control.
 */
export type ArchivedRoutinesViewProps = {
  onBack: () => void;
} & (
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | {
      status: "ready";
      routines: readonly ArchivedRoutineItem[];
      /** Brings the routine back into the list. */
      onRestore?: ((routine: RoutineRef) => void) | undefined;
    }
);
