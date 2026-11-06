import { buildBodyCompositionCard } from "@keylow/core/weight";
import { useMemo } from "react";

import { useBodyMeasurements } from "./useBodyMeasurements";
import { useBodyTrend } from "./useBodyTrend";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type {
  BodyCompositionCardData,
  BodyMeasurementKind,
  WeightRange,
} from "@keylow/core/weight";

/** What one kind's reading is, for a screen to choose its state from. */
export type BodyCompositionKind =
  | { status: "loading" | "empty" | "error"; refetch: () => void }
  | { status: "readings"; card: BodyCompositionCardData; refetch: () => void };

/**
 * One kind's readings as the Body composition section needs them: still loading, failed with nothing to
 * show, read with no readings, or read with the card to draw over the range. Data that is showing stays
 * when it is read again, so a refresh never turns a card back into a loading state. A failure with a read
 * under way counts as loading, so Try again shows that it is working. The trend is worked out by
 * `useBodyTrend`, and only the range's change and line are worked out here, by `buildBodyCompositionCard`.
 */
export function useBodyCompositionKind(
  kind: BodyMeasurementKind,
  { enabled = true, range, today }: DiaryReadOptions & { range: WeightRange; today: string },
): BodyCompositionKind {
  const list = useBodyMeasurements(kind, { enabled });
  const trend = useBodyTrend(kind, { enabled });
  const refetch = () => {
    void list.refetch();
  };

  const card = useMemo(
    () =>
      buildBodyCompositionCard(
        kind,
        { points: trend.points, settling: trend.settling },
        range,
        today,
      ),
    [kind, range, today, trend.points, trend.settling],
  );

  if (list.data === undefined) {
    return list.isError && !list.isFetching
      ? { status: "error", refetch }
      : { status: "loading", refetch };
  }

  return card === undefined ? { status: "empty", refetch } : { status: "readings", card, refetch };
}
