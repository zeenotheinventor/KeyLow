import { WEIGHT_SCREEN, describeWeighInRow } from "@keylow/core/copy";
import { Heart, Pencil } from "lucide-react";

import type { WeighInRowProps } from "./types";

import { ListRow } from "@/components/ui/ListRow";

/**
 * One weigh-in of the list: the day over the time and where it came from, the weight in kilograms, and a
 * warning badge, with the figure muted, when the trend left the reading out. The Health Connect heart and the
 * manual pencil only decorate, because the words say where it came from. Pressing a row does nothing yet:
 * the dialog that opens a weigh-in gives it an `onClick`.
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
  const hasValue = row.valueText !== "";

  return (
    <ListRow
      icon={weighIn.source === "health_connect" ? Heart : Pencil}
      title={row.day}
      subtitle={row.meta}
      badge={row.leftOut ? { label: WEIGHT_SCREEN.leftOutBadge, tone: "warning" } : undefined}
      value={hasValue ? row.valueText : undefined}
      unit={hasValue ? row.unit : undefined}
      valueLook="numeral"
      valueTone={row.leftOut ? "muted" : undefined}
      chevron={false}
    />
  );
}
