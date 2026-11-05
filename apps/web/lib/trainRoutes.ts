/** The Train home. */
export const trainPath = (): string => "/train";

/** The session in progress. */
export const trainSessionPath = (): string => `${trainPath()}/session`;

/** The routines list. */
export const trainRoutinesPath = (): string => `${trainPath()}/routines`;

/** The archived routines, opened from the routines list. */
export const trainRoutinesArchivedPath = (): string => `${trainRoutinesPath()}/archived`;
