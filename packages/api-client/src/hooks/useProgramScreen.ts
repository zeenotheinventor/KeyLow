import { toLocalDate } from "@keylow/core/dates";
import { requireStats, startSnapshot } from "@keylow/core/engine";
import { buildProgramView } from "@keylow/core/program";

import { useProfileTimeZone } from "./useProfileTimeZone";
import { useProgramSummary } from "./useProgramSummary";
import { useSetupState } from "./useSetupState";
import { useTargets } from "./useTargets";
import { useWeightUnit } from "./useWeightUnit";

import type { ExpenditureSnapshot } from "../repos/program";
import type { ProgramView } from "@keylow/core/program";

/** What the Programme screen shows: the reads' states, and when they are in, the view to write. */
export type ProgramScreenState =
  | {
      status: "loading";
      /** True when a read is waiting for a connection with nothing read yet, which stays loading until it returns. */
      isPaused: boolean;
    }
  | { status: "error"; retry: () => void }
  | { status: "no-program"; ownTargetKcal: number | null }
  | { status: "program"; view: ProgramView<ExpenditureSnapshot> };

/** What `useProgramScreen` takes. */
export type UseProgramScreenOptions = {
  /** False makes no request at all, as the diary reads do. */
  enabled: boolean;
  /** The current time, which gives today in the profile's zone. The caller owns the clock, so it can tick. */
  now: Date;
};

/**
 * What the Programme screen reads, put together as one state. The program, its newest snapshots and its
 * current targets row come from `useProgramSummary`, the targets the diary shows from `useTargets`, and the
 * weight unit and the time zone from the profile. A program with no snapshot yet, between the wizard's save
 * and its first recompute, also reads the saved setup, and its starting estimate is worked out on the device
 * by core's `startSnapshot`, which is the function the first snapshot is made with. Nothing is read while
 * `enabled` is false. Nothing here is logged: the figures are health data.
 */
export function useProgramScreen({ enabled, now }: UseProgramScreenOptions): ProgramScreenState {
  const summary = useProgramSummary({ enabled });
  const targets = useTargets({ enabled });
  const unit = useWeightUnit({ enabled });
  const timeZone = useProfileTimeZone({ enabled });

  const program = summary.data?.program ?? null;
  const hasNoSnapshot = program !== null && summary.data?.latestSnapshot === null;
  const setup = useSetupState({ enabled: enabled && hasNoSnapshot });

  const retry = () => {
    void summary.refetch();
    void targets.refetch();
    void unit.refetch();
    if (hasNoSnapshot) {
      void setup.refetch();
    }
  };

  if (summary.isError || targets.isError || unit.isError || (hasNoSnapshot && setup.isError)) {
    return { status: "error", retry };
  }
  if (
    summary.data === undefined ||
    targets.data === undefined ||
    unit.data === undefined ||
    timeZone.isPending ||
    (hasNoSnapshot && setup.data === undefined)
  ) {
    const reads = [summary, targets, unit, timeZone, ...(hasNoSnapshot ? [setup] : [])];
    return {
      status: "loading",
      isPaused: reads.some((read) => read.isPending && read.fetchStatus === "paused"),
    };
  }
  if (program === null) {
    return { status: "no-program", ownTargetKcal: targets.data.kcal };
  }

  // If the zone cannot be read the day is UTC, as the other screens read it.
  const today = toLocalDate(now, timeZone.data ?? "UTC");
  const saved = setup.data;
  const savedWeightKg = saved?.latestWeighIn?.weightKg ?? null;
  const required =
    saved === undefined
      ? null
      : requireStats({
          sex: saved.stats.sex,
          birth_date: saved.stats.birthDate,
          height_cm: saved.stats.heightCm,
          activity: saved.stats.activity,
          onboarding_weight_kg: savedWeightKg,
        });
  const start =
    required?.ok === true
      ? startSnapshot({
          stats: required.stats,
          onboardingWeightKg: required.onboardingWeightKg,
          asOfDate: today,
          trendWeightKg: null,
        })
      : null;

  const view = buildProgramView({
    program,
    latestSnapshot: summary.data.latestSnapshot,
    previousSnapshot: summary.data.previousSnapshot,
    currentTargets: summary.data.currentTargets,
    targetsRead: targets.data,
    startBelief: start === null ? null : { muKcal: start.mu_kcal, varKcal2: start.var_kcal2 },
    fallbackWeightKg: savedWeightKg,
    unit: unit.data,
    today,
  });

  return view === null ? { status: "error", retry } : { status: "program", view };
}
