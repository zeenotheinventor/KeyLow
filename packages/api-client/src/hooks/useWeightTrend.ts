import { computeTrend } from "@keylow/core/engine";
import { isTrendSettling, weeklyRateKg } from "@keylow/core/weight";
import { useMemo } from "react";

import { useWeighIns } from "./useWeighIns";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { WeighIn } from "../repos/weighInSchemas";
import type { TrendPoint } from "@keylow/core/engine";

const NO_WEIGH_INS: WeighIn[] = [];

function deriveTrend(weighIns: readonly WeighIn[]) {
  const points = computeTrend(
    weighIns.map((weighIn) => ({ localDate: weighIn.local_date, weightKg: weighIn.weight_kg })),
  );

  return {
    points,
    byDate: new Map<string, TrendPoint>(points.map((point) => [point.date, point])),
    weeklyRateKg: weeklyRateKg(points),
    settling: isTrendSettling(points),
  };
}

/**
 * The trend weight over the cached weigh-in list, worked out on the device with `computeTrend` from
 * core each time the list changes, and not on a re-render. Nothing is stored or cached under a key of
 * its own: it is derived from `useWeighIns`, so a write that refreshes the list refreshes the trend.
 *
 * `points` are in date order, `byDate` finds a day's point (it says whether a reading was rejected or
 * winsorised), `weeklyRateKg` is the change over the last 7 days (negative is loss, null when unknown)
 * and `settling` is true while the trend has too few readings to trust.
 */
export function useWeightTrend({ enabled = true }: DiaryReadOptions = {}) {
  const { data, isLoading, isError } = useWeighIns({ enabled });
  const trend = useMemo(() => deriveTrend(data ?? NO_WEIGH_INS), [data]);

  return { ...trend, isLoading, isError };
}
