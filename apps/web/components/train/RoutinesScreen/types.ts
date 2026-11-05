import type { RoutineCardProps } from "../RoutineCard";

/** What a handler needs to name the routine it acts on. */
export type RoutineRef = {
  id: string;
  name: string;
};

/** A routine of the list, as the card and the rows read it. */
export type RoutineItem = Pick<RoutineCardProps, "days" | "name" | "setsPerWeek"> & {
  id: string;
};

/**
 * Every control is drawn only when its handler is given, so none is a dead control. The routines page gives
 * none yet: the routine editor supplies Create and Edit.
 */
export type RoutinesScreenProps = {
  /** Opens the new routine editor. Draws New routine beside the title, and Create routine when there are no routines. */
  onCreateRoutine?: (() => void) | undefined;
  /** Opens a routine's editor. Makes the active routine's card and each other routine's row a button. */
  onEditRoutine?: ((routine: RoutineRef) => void) | undefined;
};
