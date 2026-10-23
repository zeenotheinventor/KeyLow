import { computeBodyTrend, isBodyTrendSettling } from "@keylow/core/weight";
import { useMemo } from "react";

import { useBodyMeasurements } from "./useBodyMeasurements";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { BodyMeasurement } from "../repos/bodyMeasurementSchemas";
import type { BodyMeasurementKind, BodyTrendPoint } from "@keylow/core/weight";

const NO_MEASUREMENTS: BodyMeasurement[] = [];

function deriveTrend(measurements: readonly BodyMeasurement[], kind: BodyMeasurementKind) {
  const points = computeBodyTrend(
    measurements.map((measurement) => ({
      localDate: measurement.local_date,
      value: measurement.value,
    })),
    kind,
  );

  return {
    points,
    byDate: new Map<string, BodyTrendPoint>(points.map((point) => [point.date, point])),
    settling: isBodyTrendSettling(points),
  };
}

/**
 * The smoothed trend of one kind over the cached measurement list, worked out on the device with
 * `computeBodyTrend` from core each time the list changes, and not on a re-render. Nothing is stored or
 * cached under a key of its own: it is derived from `useBodyMeasurements`, so an import that refreshes
 * the list refreshes the trend. The change over a range is left to the screen, which knows the range
 * (`bodyChangeOverRange` in core).
 *
 * `points` are in date order, `byDate` finds a day's point, and `settling` is true while the trend has
 * too few reading days to trust.
 */
export function useBodyTrend(kind: BodyMeasurementKind, { enabled = true }: DiaryReadOptions = {}) {
  const { data, isLoading, isError } = useBodyMeasurements(kind, { enabled });
  const trend = useMemo(() => deriveTrend(data ?? NO_MEASUREMENTS, kind), [data, kind]);

  return { ...trend, isLoading, isError };
}
