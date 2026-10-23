import { WEIGHT_SCREEN, describeWeighInRow } from "@keylow/core/copy";

import { ListRow } from "../../ui";

import type { WeighInRowProps } from "./types";

/**
 * One weigh-in of the list: the day over the time and where it came from, the weight in kilograms, and a
 * warning badge when the trend left the reading out. The Health Connect heart and the manual pencil only
 * decorate, because the words say where it came from. The row goes nowhere yet, so it has no chevron.
 */
export function WeighInRow({ weighIn, today, isLeftOut }: WeighInRowProps) {
  const row = describeWeighInRow({
    localDate: weighIn.local_date,
    today,
    measuredAt: new Date(weighIn.measured_at),
    timeZone: weighIn.tz,
    source: weighIn.source,
    weightKg: weighIn.weight_kg,
    rejected: isLeftOut,
  });

  return (
    <ListRow
      badge={row.leftOut ? { label: WEIGHT_SCREEN.leftOutBadge, tone: "warning" } : undefined}
      icon={weighIn.source === "health_connect" ? "Heart" : "Pencil"}
      size="compact"
      subtitle={row.meta}
      title={row.day}
      unit={row.valueText === "" ? undefined : row.unit}
      value={row.valueText === "" ? undefined : row.valueText}
      valueTone={row.leftOut ? "muted" : undefined}
    />
  );
}
