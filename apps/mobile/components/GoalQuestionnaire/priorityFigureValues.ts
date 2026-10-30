import { PRIORITY_GROUP_VOLUME_STATUS, VOLUME_STATUSES } from "@keylow/core/training";

import type { BodyFigureValues } from "../ui";
import type { PrioritySummary } from "@keylow/core/training";

const GROUPS = ["first", "keptUp", "notTargeted"] as const;

/**
 * The value of each muscle on the figure's volume scale: the status core names for its group, as an index
 * in `VOLUME_STATUSES`. Every muscle is in exactly one group, so every muscle has a value.
 */
export function priorityFigureValues(summary: PrioritySummary): BodyFigureValues {
  return Object.fromEntries(
    GROUPS.flatMap((group) =>
      summary[group].map((muscle) => [
        muscle,
        VOLUME_STATUSES.indexOf(PRIORITY_GROUP_VOLUME_STATUS[group]),
      ]),
    ),
  );
}
