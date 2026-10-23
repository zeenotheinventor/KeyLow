import { WEIGHT_SCREEN, describeWeighInRow } from "@keylow/core/copy";
import { useIsFocused, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { ListRow } from "../../ui";

import type { WeighInRowProps } from "./types";

/**
 * One weigh-in of the list: the day over the time and where it came from, the weight in kilograms, and a
 * warning badge when the trend left the reading out. The Health Connect heart and the manual pencil only
 * decorate, because the words say where it came from. The board draws no chevron. Pressing the row opens the
 * weigh-in in the sheet, to edit or delete a manual one or to delete an imported one. A second tap before the
 * sheet has taken the screen opens nothing more.
 */
export function WeighInRow({ weighIn, today, isLeftOut }: WeighInRowProps) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const hasOpenedRef = useRef(false);
  const row = describeWeighInRow({
    localDate: weighIn.local_date,
    today,
    measuredAt: new Date(weighIn.measured_at),
    timeZone: weighIn.tz,
    source: weighIn.source,
    weightKg: weighIn.weight_kg,
    rejected: isLeftOut,
  });

  // The row is pressable again when the screen is back in front.
  useEffect(() => {
    if (isFocused) {
      hasOpenedRef.current = false;
    }
  }, [isFocused]);

  return (
    <ListRow
      badge={row.leftOut ? { label: WEIGHT_SCREEN.leftOutBadge, tone: "warning" } : undefined}
      chevron={false}
      icon={weighIn.source === "health_connect" ? "Heart" : "Pencil"}
      size="compact"
      subtitle={row.meta}
      title={row.day}
      unit={row.valueText === "" ? undefined : row.unit}
      value={row.valueText === "" ? undefined : row.valueText}
      valueTone={row.leftOut ? "muted" : undefined}
      onPress={() => {
        if (hasOpenedRef.current) {
          return;
        }
        hasOpenedRef.current = true;
        router.push(`/more/weight/entry?id=${weighIn.id}`);
      }}
    />
  );
}
