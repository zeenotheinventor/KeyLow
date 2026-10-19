/** The routines list, a screen pushed inside the Train tab so the tab bar stays. */
export const routinesPath = (): string => "/train/routines";

/** The archived routines, pushed over the routines list. */
export const archivedRoutinesPath = (): string => `${routinesPath()}/archived`;

/** The Train tab, where the routines list's Back goes when nothing is before it. */
export const trainPath = (): string => "/train";
