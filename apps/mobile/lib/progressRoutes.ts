import { routinesPath } from "./routineRoutes";

/**
 * The graph of one exercise's progress, a screen pushed inside the Train tab over the routines list. The
 * address carries the exercise's id and nothing else, never its name, a load or a rep: an address can reach
 * a log, and what an exercise is called or lifts is health data.
 */
export const exerciseProgressPath = (exerciseId: string): string => `/train/progress/${exerciseId}`;

/** Where the graph's Back goes when nothing is before it: the routines list the progress is read from. */
export const progressBackPath = (): string => routinesPath();
