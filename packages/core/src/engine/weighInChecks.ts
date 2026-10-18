import { isCalendarDay } from "../dates";

import type { TrendInput } from "./types";

const MIN_SANE_WEIGHT_KG = 20;
const MAX_SANE_WEIGHT_KG = 400;

/**
 * Throws a RangeError for a `localDate` that is not a real `YYYY-MM-DD` day or a weight that is not
 * finite. The message states the rule only, because a weight is health data and must not reach a log.
 */
export function assertWeighIns(weighIns: readonly TrendInput[]): void {
  for (const { localDate, weightKg } of weighIns) {
    if (!isCalendarDay(localDate)) {
      throw new RangeError("A weigh-in date must be a real calendar day written YYYY-MM-DD.");
    }
    if (!Number.isFinite(weightKg)) {
      throw new RangeError("A weigh-in weight must be a finite number of kilograms.");
    }
  }
}

/** Drops the readings outside 20 to 400 kg. The database refuses them too, so this is a sanity bound. */
export function dropImplausibleWeights(weighIns: readonly TrendInput[]): TrendInput[] {
  return weighIns.filter(
    ({ weightKg }) => weightKg >= MIN_SANE_WEIGHT_KG && weightKg <= MAX_SANE_WEIGHT_KG,
  );
}
