import { dailyMedians } from "./dailyMedians";
import { DEFAULT_ENGINE_PARAMS } from "./params";
import { segmentTrend } from "./segmentTrend";
import { splitSegments } from "./splitSegments";
import { assertWeighIns, dropImplausibleWeights } from "./weighInChecks";

import type { TrendParams } from "./params";
import type { TrendInput, TrendPoint } from "./types";

/**
 * The trend weight, always a full recompute from the raw weigh-ins. Pure: no clock, no randomness,
 * nothing rounded. `weighIns` are live weigh-ins in any order, with any number of readings per date.
 * A malformed date or a weight that is not finite throws a RangeError before any maths. A reading
 * outside 20 to 400 kg is skipped. The points come out in date order across all segments.
 */
export function computeTrend(
  weighIns: readonly TrendInput[],
  params: TrendParams = DEFAULT_ENGINE_PARAMS.trend,
): TrendPoint[] {
  assertWeighIns(weighIns);
  const days = dailyMedians(dropImplausibleWeights(weighIns));

  return splitSegments(days, params.maxGapDays).flatMap((segmentDays, segment) =>
    segmentTrend(segmentDays, segment, params),
  );
}
