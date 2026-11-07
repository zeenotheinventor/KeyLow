import { toLocalDate } from "../../dates/toLocalDate";

import type { PlanRoutine } from "../expandPlan";

/** A routine as stored: its days, and the instant it was made active, or null when none was recorded. */
export type StoredPlanRoutine = Readonly<{
  days: PlanRoutine["days"];
  activatedAt?: string | null;
}>;

/**
 * The routine as core plans from it: the stored routine with `activeFrom` set to the local day in
 * `timeZone` of the instant it was made active, so the plan starts that day (ADR 0005). A routine with no
 * recorded activation, or one cached before the field existed, plans the whole week, as it did before.
 * The date is worked out here at read time and never stored, since it depends on the user's zone.
 */
export function planRoutineOf<Routine extends StoredPlanRoutine>(
  routine: Routine | null,
  timeZone: string,
): (Routine & Pick<PlanRoutine, "activeFrom">) | null {
  if (routine === null) {
    return null;
  }
  // Falsy covers a routine cached before the field existed, which has no `activatedAt` at all.
  if (!routine.activatedAt) {
    return routine;
  }
  return { ...routine, activeFrom: toLocalDate(new Date(routine.activatedAt), timeZone) };
}
