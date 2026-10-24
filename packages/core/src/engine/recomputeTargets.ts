import { DEFAULT_ENGINE_PARAMS } from "./params";
import { targetsRow } from "./targetsRow";

import type { CheckinProgram } from "./checkinStep";
import type { EngineParams } from "./params";
import type { EngineTargetsRow, TargetsRowBasis } from "./targetsRow";

/** What a targets row's `basis` holds after a recompute: a check-in's keys, with the other sources. */
export type RecomputeBasis = TargetsRowBasis<"start" | "recompute">;

/** The `targets` row of a recompute, with the database's column names. */
export type RecomputeTargetsRow = EngineTargetsRow<"start" | "recompute">;

export type RecomputeInput = Readonly<{
  /** The user's newest snapshot: its mean is the expenditure the targets start from. */
  snapshot: Readonly<{ kind: "start" | "checkin"; mu_kcal: number }>;
  /** The trend weight on yesterday, or the onboarding weight when the user has no weigh-in. */
  trendWeightKg: number;
  program: CheckinProgram;
  /** Mifflin-St Jeor of the profile's stats on `today`, in kilocalories a day. The floor uses it. */
  bmrKcal: number;
  /** The user's local today, `YYYY-MM-DD`. The targets are effective from it. */
  today: string;
}>;

/**
 * The targets row of a recompute, which happens when the program is edited and at the end of setup (ADR 0002,
 * Amendment 2, "Recompute"). The targets are derived from the newest snapshot's `mu`, the trend weight and
 * the program, then the setup layer's 6000 cap follows and records `profile_max`, through `targetsRow`, as a
 * check-in does. The basis names its source: `start` when the snapshot is a start snapshot, `recompute` after
 * a check-in. Pure: it makes no snapshot, and nothing is rounded except the targets.
 */
export function recomputeTargets(
  { snapshot, trendWeightKg, program, bmrKcal, today }: RecomputeInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): RecomputeTargetsRow {
  return targetsRow(
    {
      source: snapshot.kind === "start" ? "start" : "recompute",
      effectiveFrom: today,
      muKcal: snapshot.mu_kcal,
      trendWeightKg,
      program,
      bmrKcal,
    },
    params,
  );
}
