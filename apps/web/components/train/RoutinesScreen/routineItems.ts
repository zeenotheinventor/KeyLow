import { toLocalDate } from "@keylow/core/dates";

import type { RoutineItem } from "./types";
import type { useRoutines } from "@keylow/api-client";

export type StoredRoutine = NonNullable<ReturnType<typeof useRoutines>["data"]>[number];

export const routineItemOf = (routine: StoredRoutine): RoutineItem => ({
  id: routine.id,
  name: routine.name,
  days: routine.days.map(({ name, weekday }) => ({ name, weekday })),
  setsPerWeek: routine.summary.setsPerWeek,
});

/**
 * The calendar day the routine began to plan from, in the profile's time zone, or null when the routine
 * was never activated or the zone is not known yet. A profile with no zone is read as UTC. The day is never
 * guessed, so the card leaves it out until the zone is known.
 */
export function activeFromOf(
  routine: StoredRoutine,
  timeZone: string | null | undefined,
): string | null {
  if (routine.activated_at === null || timeZone === undefined) {
    return null;
  }
  return toLocalDate(new Date(routine.activated_at), timeZone ?? "UTC");
}
