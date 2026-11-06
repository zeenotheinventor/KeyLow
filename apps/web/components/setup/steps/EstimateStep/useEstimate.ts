"use client";

import {
  fallbackWeightKgOf,
  measuredEstimateOf,
  setupAnswersSchemaFor,
  startingPlan,
  storedWeightUnitOf,
} from "@keylow/core/setup";
import { useMemo } from "react";

import type { ProgrammeReads } from "../../useProgrammeReads";
import type { SetupState } from "@keylow/api-client";
import type { SetupDraft } from "@keylow/core/setup";

type EstimateInput = {
  draft: SetupDraft;
  /** Today in the profile's time zone, which dates the age and the weigh-in. */
  today: string;
  /** The saved setup, or undefined while it is not known. */
  setupState: SetupState | undefined;
  programme: ProgrammeReads;
};

/**
 * The plan the estimate draws and saves, and what a recalculation after a check-in keeps of the expenditure. The
 * figures are all core's: `startingPlan` of the answers, and `measuredEstimateOf` over the history and the weight
 * trend. The answers are complete here, since the address has been checked, so the schema only narrows the type.
 * With the saved setup not known the stored weight unit is not either, so the plan is made again when it arrives.
 */
export function useEstimate({ draft, today, setupState, programme }: EstimateInput) {
  const storedWeightUnit = storedWeightUnitOf(setupState?.stats.weightUnit ?? null);
  const { expenditureHistory, weightTrend } = programme;

  const base = useMemo(() => {
    const answers = setupAnswersSchemaFor(today).safeParse(draft);
    return answers.success
      ? { answers: answers.data, plan: startingPlan(answers.data, today, storedWeightUnit) }
      : undefined;
  }, [draft, today, storedWeightUnit]);

  // Undefined when the recompute starts again from the answers, until every read is known and when any of them
  // failed. The estimate of the answers is then drawn as it is, and the save's recompute still writes the engine's
  // targets.
  const measured = useMemo(() => {
    if (
      base === undefined ||
      expenditureHistory.data === undefined ||
      weightTrend.isLoading ||
      weightTrend.isError
    ) {
      return undefined;
    }
    return measuredEstimateOf({
      answers: base.answers,
      plan: base.plan,
      today,
      history: expenditureHistory.data,
      trendPoints: weightTrend.points,
      fallbackWeightKg: fallbackWeightKgOf(setupState?.latestWeighIn?.weightKg, base.answers),
    });
  }, [
    base,
    today,
    expenditureHistory.data,
    setupState?.latestWeighIn?.weightKg,
    weightTrend.isError,
    weightTrend.isLoading,
    weightTrend.points,
  ]);

  if (base === undefined) {
    return undefined;
  }
  const shown = measured ?? base;

  // The save is the answers' own plan either way, as `measuredEstimateOf` leaves it. Only the drawing changes.
  return {
    save: base.plan.save,
    answers: shown.answers,
    plan: shown.plan,
    measurement: measured?.measurement,
  };
}
