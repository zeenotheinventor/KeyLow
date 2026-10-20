import type { RoutineProgressState } from "../RoutineProgressDay";
import type { RoutineCardInput } from "@keylow/core/copy";

/** A routine of the list: its id, its name, its days with their weekdays and the sets in a week. */
export type RoutineItem = RoutineCardInput & {
  id: string;
  name: string;
};

/** The active routine, with the calendar day it began to plan from, or null when that is not known. */
export type ActiveRoutineItem = RoutineItem & {
  activeFrom: string | null;
};

/** An archived routine: how many days it has. The database does not keep the day it was archived. */
export type ArchivedRoutineItem = {
  id: string;
  name: string;
  dayCount: number;
};

/** What a button needs to name the routine it acts on. */
export type RoutineRef = Pick<RoutineItem, "id" | "name">;

/**
 * What the routines list shows: the active routine and the others, and how many are archived, or, for a
 * list that is not there yet, a loading or failed state. Each control is drawn only when its handler is
 * given, so none is a dead control: the make active, editor and create tickets supply theirs.
 */
export type RoutinesViewProps = {
  onBack: () => void;
  /** Opens the archived routines. The link is drawn when some are archived. */
  onOpenArchived: () => void;
  /** Opens the new routine editor. Draws New routine in the header, and Create routine when there are none. */
  onCreateRoutine?: (() => void) | undefined;
  /** Opens a routine's editor. Makes the active routine's card and each other routine's name a button. */
  onEditRoutine?: ((routine: RoutineRef) => void) | undefined;
  /** Makes a routine active. Draws Make active on each other routine. */
  onMakeActive?: ((routine: RoutineRef) => void) | undefined;
  /**
   * The active routine's progress, drawn under the routines as a Progress section when it is given, with the
   * routine's days as its groups. Only a `ready` list with an active routine draws it, and a routine with no
   * exercise draws nothing.
   */
  progress?: RoutineProgressState | undefined;
  /** Opens an exercise's graph by its id. The progress rows are plain information without it. */
  onOpenExercise?: ((exerciseId: string) => void) | undefined;
} & (
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | {
      status: "ready";
      active: ActiveRoutineItem | null;
      others: readonly RoutineItem[];
      archivedCount: number;
    }
);
