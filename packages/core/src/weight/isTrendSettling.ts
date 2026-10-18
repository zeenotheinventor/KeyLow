import { TREND_SETTLED_OBS } from "./bounds";

import type { TrendPoint } from "../engine";

/**
 * Whether the trend is still settling: the last point has fewer than 7 accepted readings (days) in its
 * segment. False for no points, because there is nothing to settle and the empty state is the screen's.
 */
export function isTrendSettling(points: readonly TrendPoint[]): boolean {
  const last = points[points.length - 1];

  return last !== undefined && last.nObs < TREND_SETTLED_OBS;
}
