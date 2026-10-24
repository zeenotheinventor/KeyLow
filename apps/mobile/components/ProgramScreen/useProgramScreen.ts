import {
  useProfileTimeZone,
  useProgramSummary,
  useSetupState,
  useTargets,
  useWeightUnit,
} from "@keylow/api-client";
import { toLocalDate } from "@keylow/core/dates";
import { requireStats, startSnapshot } from "@keylow/core/engine";

import { buildProgramView } from "./buildProgramView";
import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { ProgramScreenState } from "./types";

/**
 * What the Programme screen reads, put together as one state. The program, its newest snapshots and its
 * current targets row come from `useProgramSummary`, the targets the diary shows from `useTargets`, and the
 * weight unit and the time zone from the profile. A program with no snapshot yet, between the wizard's save
 * and its first recompute, also reads the saved setup, and its starting estimate is worked out on the device
 * by core's `startSnapshot`, which is the function the first snapshot is made with. Nothing is read while the
 * terms are not accepted. Nothing here is logged: the figures are health data.
 */
export function useProgramScreen(): ProgramScreenState {
  const enabled = useReadsEnabled();
  const summary = useProgramSummary({ enabled });
  const targets = useTargets({ enabled });
  const unit = useWeightUnit({ enabled });
  const timeZone = useProfileTimeZone({ enabled });
  const now = useNow();

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
    return { status: "loading" };
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
