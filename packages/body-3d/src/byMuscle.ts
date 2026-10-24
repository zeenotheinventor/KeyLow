import { MUSCLE_IDS } from "@keylow/body-model/meshNames";

import type { MuscleId } from "@keylow/body-model/meshNames";

/** A record with one value for each of the 22 muscle ids, each made by `make`. */
export function byMuscle<Value>(make: (id: MuscleId) => Value): Record<MuscleId, Value> {
  // Object.fromEntries types its keys as strings. The list is the 22 ids, so every key of the record is there.
  return Object.fromEntries(MUSCLE_IDS.map((id) => [id, make(id)])) as Record<MuscleId, Value>;
}

/** Whether a mesh name is one of the 22 muscle ids. */
export const isMuscleId = (name: string): name is MuscleId => MUSCLE_IDS.some((id) => id === name);
