import { expenditureBand } from "@keylow/core/program";
import { z } from "zod";

import type { CheckinResult } from "@keylow/core/engine";

/** One check-in of a replay: what the engine believed, what it did to the belief, and the targets it set. */
export const replayRowSchema = z.object({
  asOfDate: z.string(),
  eligible: z.boolean(),
  /** Why the window could not be measured. Empty when it was eligible. */
  reasons: z.array(z.enum(["span", "weigh_days", "complete_days"])),
  /** The expenditure estimate after the check-in, unrounded, in kilocalories a day. */
  muKcal: z.number(),
  /** The ends of the 80 % range of the estimate, each rounded to 10. */
  bandLowKcal: z.number(),
  bandHighKcal: z.number(),
  /** The Kalman gain K. Null when the window could not be measured. */
  gain: z.number().nullable(),
  /** The step the estimate took, after the weekly clamp. Null when the window could not be measured. */
  stepKcal: z.number().nullable(),
  stepClamped: z.boolean().nullable(),
  /** Null when the targets used the onboarding weight, because there was no weigh-in to make a trend. */
  trendWeightKg: z.number().nullable(),
  caloriesKcal: z.number(),
  proteinG: z.number(),
  fatG: z.number(),
  carbsG: z.number(),
  clamps: z.array(z.string()),
});

export const replayRowsSchema = z.array(replayRowSchema);

export type ReplayRow = z.infer<typeof replayRowSchema>;

/** The row of one check-in's snapshot and targets. */
export function toReplayRow({ snapshot, targets }: CheckinResult): ReplayRow {
  const { measurement } = snapshot;
  const band = expenditureBand({ muKcal: snapshot.mu_kcal, varKcal2: snapshot.var_kcal2 });
  return {
    asOfDate: snapshot.as_of_date,
    eligible: measurement.eligible,
    reasons: measurement.eligible ? [] : [...measurement.reasons],
    muKcal: snapshot.mu_kcal,
    bandLowKcal: band.lowKcal,
    bandHighKcal: band.highKcal,
    gain: measurement.eligible ? measurement.gain : null,
    stepKcal: measurement.eligible ? measurement.stepKcal : null,
    stepClamped: measurement.eligible ? measurement.stepClamped : null,
    trendWeightKg: snapshot.trend_weight_kg,
    caloriesKcal: targets.calories_kcal,
    proteinG: targets.protein_g,
    fatG: targets.fat_g,
    carbsG: targets.carbs_g,
    clamps: [...targets.basis.clamps],
  };
}
