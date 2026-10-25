import { useBodyMeasurements, useBodyTrend } from "@keylow/api-client";
import { bodyChangeOverRange, bodyPointsInRange } from "@keylow/core/weight";
import { useMemo } from "react";

import { bodyLineSeries } from "./bodyLineSeries";

import type { BodyCompositionCardProps } from "../BodyCompositionCard";
import type { BodyMeasurementKind, WeightRange } from "@keylow/core/weight";

/** What one kind's reading is, for the section to choose its state from. */
export type BodyCompositionKind =
  | { status: "loading" | "empty" | "error"; refetch: () => void }
  | { status: "readings"; card: BodyCompositionCardProps; refetch: () => void };

/**
 * One kind's readings as the section needs them: still loading, failed with nothing to show, read with no
 * readings, or read with the card to draw over the range. Data that is showing stays when it is read
 * again, so a refresh never turns a card back into a loading state. A failure with a read under way
 * counts as loading, so Try again shows that it is working. The trend is worked out by `useBodyTrend`,
 * and only the range's change and line are worked out here. A settling trend has the line and no change.
 */
export function useBodyCompositionKind(
  kind: BodyMeasurementKind,
  { isEnabled, range, today }: { isEnabled: boolean; range: WeightRange; today: string },
): BodyCompositionKind {
  const list = useBodyMeasurements(kind, { enabled: isEnabled });
  const trend = useBodyTrend(kind, { enabled: isEnabled });
  const refetch = () => {
    void list.refetch();
  };

  const card = useMemo((): BodyCompositionCardProps | undefined => {
    const latest = trend.points.at(-1);
    if (latest === undefined) {
      return undefined;
    }
    const base = { kind, trend: latest.trend, range };
    const pointsInRange = bodyPointsInRange(trend.points, range, today);
    if (trend.settling) {
      return {
        ...base,
        state: "settling",
        readingCount: latest.nObs,
        line: pointsInRange.length === 0 ? null : bodyLineSeries(pointsInRange, range, today),
      };
    }
    const change = bodyChangeOverRange(trend.points, range, today);

    return change === null || pointsInRange.length < 2
      ? { ...base, state: "range-empty" }
      : { ...base, state: "chart", change, line: bodyLineSeries(pointsInRange, range, today) };
  }, [kind, range, today, trend.points, trend.settling]);

  if (list.data === undefined) {
    return list.isError && !list.isFetching
      ? { status: "error", refetch }
      : { status: "loading", refetch };
  }

  return card === undefined ? { status: "empty", refetch } : { status: "readings", card, refetch };
}
