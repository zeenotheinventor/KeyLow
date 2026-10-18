import type { WorkoutSetRow } from "../schemas/training";

/** Whether a set counts as a working set: working, drop and failure do, a warm-up never does. */
export const isWorkingType = (set: Pick<WorkoutSetRow, "set_type">): boolean =>
  set.set_type !== "warmup";
