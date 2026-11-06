import type { SessionOrigin } from "@keylow/core/copy";

/** The Train home. */
export const trainPath = (): string => "/train";

/** The session in progress. */
export const trainSessionPath = (): string => `${trainPath()}/session`;

/** The routines list. */
export const trainRoutinesPath = (): string => `${trainPath()}/routines`;

/** The archived routines, opened from the routines list. */
export const trainRoutinesArchivedPath = (): string => `${trainRoutinesPath()}/archived`;

/** The history of logged sessions, by week. */
export const trainHistoryPath = (): string => `${trainPath()}/history`;

/**
 * One logged session's detail. The detail names its Back link for the screen it was opened from, so an
 * address opened from the Train home says so, as the phone's does.
 */
export const trainSessionDetailPath = (
  sessionId: string,
  origin: SessionOrigin = "history",
): string => `${trainHistoryPath()}/${sessionId}${origin === "train" ? "?from=train" : ""}`;

/** The editor for a new routine. */
export const trainRoutineNewPath = (): string => `${trainRoutinesPath()}/new`;

/** The editor for one stored routine. */
export const trainRoutineEditPath = (id: string): string => `${trainRoutinesPath()}/${id}`;

/** One exercise's progress by week. The path carries the exercise's id and never its name. */
export const trainExerciseProgressPath = (exerciseId: string): string =>
  `${trainPath()}/progress/${exerciseId}`;
