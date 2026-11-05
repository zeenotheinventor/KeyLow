import { VOLUME_STATUSES } from "./muscleState";
import { PRIORITY_GROUP_VOLUME_STATUS } from "./prioritySummary";

import type { MuscleId } from "./muscles";
import type { PrioritySummary } from "./prioritySummary";

const GROUPS = ["first", "keptUp", "notTargeted"] as const;

/**
 * The value of each muscle on the body figure's volume scale: the status core names for its group, as an
 * index in `VOLUME_STATUSES`. Every muscle is in exactly one group, so every muscle has a value.
 */
export const priorityFigureValues = (summary: PrioritySummary): Partial<Record<MuscleId, number>> =>
  Object.fromEntries(
    GROUPS.flatMap((group) =>
      summary[group].map((muscle) => [
        muscle,
        VOLUME_STATUSES.indexOf(PRIORITY_GROUP_VOLUME_STATUS[group]),
      ]),
    ),
  );
