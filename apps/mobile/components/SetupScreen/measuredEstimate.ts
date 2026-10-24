import { addCalendarDays } from "@keylow/core/dates";
import { profileBmr, recomputeTargets, startSnapshotAction } from "@keylow/core/engine";

import type { EstimateMeasurement } from "./steps/EstimateStep";
import type { ExpenditureSnapshot } from "@keylow/api-client";
import type { TrendPoint } from "@keylow/core/engine";
import type { SetupAnswers, StartingPlan } from "@keylow/core/setup";

export type MeasuredEstimateInput = Readonly<{
  answers: SetupAnswers;
  /** What `startingPlan` made of those answers. Its save is the one that is made, and is left as it is. */
  plan: StartingPlan;
  /** The person's local today, `YYYY-MM-DD`, in the profile's time zone. */
  today: string;
  /**
   * The user's expenditure history in any order, from `useExpenditureHistory`: at least the last 28 days, which
   * is as far back as the recompute keeps a snapshot. Snapshots of an ended program count, as they do there.
   */
  history: readonly ExpenditureSnapshot[];
  /** The weight trend in date order, from `useWeightTrend`. */
  trendPoints: readonly Pick<TrendPoint, "date" | "trendKg">[];
  /** The weight to use when no trend point is on or before yesterday: the latest weigh-in's. */
  fallbackWeightKg: number;
}>;

export type MeasuredEstimate = Readonly<{
  /** The answers with the trend weight the targets are worked out on, which the rate and guardrail lines read. */
  answers: SetupAnswers;
  /** The plan to draw: the newest check-in's expenditure and the targets the recompute will write. */
  plan: StartingPlan;
  measurement: EstimateMeasurement;
}>;

// No day of week offsets exist in v1, and no screen sets them (ADR 0002, Amendment 2).
const NO_DAY_OF_WEEK_OFFSETS = [0, 0, 0, 0, 0, 0, 0] as const;

function isMeasuredCheckin(snapshot: ExpenditureSnapshot): boolean {
  return snapshot.kind === "checkin" && snapshot.measurement.eligible;
}

/** The date of the newest check-in that measured, or undefined when none did. */
function newestMeasuredDate(history: readonly ExpenditureSnapshot[]): string | undefined {
  return history
    .filter(isMeasuredCheckin)
    .map((snapshot) => snapshot.asOfDate)
    .sort()
    .at(-1);
}

/**
 * What a recalculation will write once a check-in has run, to draw on the estimate (ADR 0002, Amendment 2,
 * "Recompute", and Q4 of KEY-604: after the first measurement, a recalculation keeps the measured
 * expenditure). It decides as the server's recompute does: from the user's newest snapshot, of any program,
 * by core's `startSnapshotAction`. Only `none` keeps that snapshot's mean. A user with no snapshot, a
 * start snapshot as the newest (settling) or a newest snapshot more than 28 days old starts again from the
 * answers, so this answers undefined and the estimate of the answers is drawn as it is. Otherwise the figures
 * are core's `recomputeTargets` of the newest snapshot's mean, the trend weight on yesterday, the answers'
 * program and `profileBmr` on today, as the save's recompute will make them. Nothing is worked out here.
 */
export function measuredEstimateOf({
  answers,
  plan,
  today,
  history,
  trendPoints,
  fallbackWeightKg,
}: MeasuredEstimateInput): MeasuredEstimate | undefined {
  const newest = [...history]
    .sort((first, second) => first.asOfDate.localeCompare(second.asOfDate))
    .at(-1);
  const action = startSnapshotAction({
    latest: newest === undefined ? null : { kind: newest.kind, as_of_date: newest.asOfDate },
    today,
    settling: newest?.kind === "start",
  });
  if (newest === undefined || action !== "none") {
    return undefined;
  }

  const yesterday = addCalendarDays(today, -1);
  const trendWeightKg =
    trendPoints.filter((point) => point.date <= yesterday).at(-1)?.trendKg ?? fallbackWeightKg;
  const { program } = plan.save;
  const targets = recomputeTargets({
    snapshot: { kind: "checkin", mu_kcal: newest.muKcal },
    trendWeightKg,
    program: {
      goal: program.goal,
      ratePctPerWeek: program.rate_pct_per_week,
      proteinGPerKg: program.protein_g_per_kg,
      fatFraction: program.fat_fraction_of_remaining,
      dowOffsetsKcal: NO_DAY_OF_WEEK_OFFSETS,
    },
    bmrKcal: profileBmr(answers, answers.weightKg, today),
    today,
  });
  const measuredOn = newestMeasuredDate(history);

  return {
    answers: { ...answers, weightKg: trendWeightKg },
    plan: {
      ...plan,
      estimate: { bmrKcal: targets.basis.bmrKcal, expenditureKcal: newest.muKcal },
      targets: {
        caloriesKcal: targets.calories_kcal,
        proteinG: targets.protein_g,
        fatG: targets.fat_g,
        carbsG: targets.carbs_g,
      },
      clamps: targets.basis.clamps,
      effectiveRatePctPerWeek: targets.basis.effectiveRatePctPerWeek,
    },
    measurement:
      measuredOn === undefined ? { kind: "carried-forward" } : { kind: "measured", measuredOn },
  };
}
