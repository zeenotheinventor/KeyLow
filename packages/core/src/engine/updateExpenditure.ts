import { DEFAULT_ENGINE_PARAMS } from "./params";

import type { EngineParams } from "./params";
import type {
  EligibleMeasurement,
  ExpenditureBelief,
  ExpenditureUpdate,
  IneligibleMeasurement,
  MeasureExpenditureResult,
} from "./types";

function clamp(value: number, range: Readonly<{ min: number; max: number }>): number {
  return Math.min(Math.max(value, range.min), range.max);
}

/**
 * Takes one check-in's measurement into the belief about daily energy expenditure: a scalar Kalman step
 * (ADR 0002, Amendment 2, "The update"). Pure: nothing is rounded.
 *
 * The belief first drifts by one process step, `P = var + processSd^2`, once per call. With an eligible
 * measurement the mean then moves towards `zKcal` by the gain `K = P / (P + rKcal2)` of the gap, held to
 * the weekly clamp, and the variance shrinks to `(1 - K) * P` from the unclamped gain. The mean is also
 * held to the expenditure range, which only matters for a prior that began outside it. With no
 * measurement, an ineligible one or `null`, the mean stays and the variance becomes `P`: a belief that is
 * not checked gets less certain. That result carries no step fields.
 */
export function updateExpenditure(
  prior: ExpenditureBelief,
  measurement: EligibleMeasurement,
  params?: EngineParams,
): ExpenditureUpdate;
export function updateExpenditure(
  prior: ExpenditureBelief,
  measurement: IneligibleMeasurement | null,
  params?: EngineParams,
): ExpenditureBelief;
export function updateExpenditure(
  prior: ExpenditureBelief,
  measurement: MeasureExpenditureResult | null,
  params?: EngineParams,
): ExpenditureBelief | ExpenditureUpdate;
export function updateExpenditure(
  prior: ExpenditureBelief,
  measurement: MeasureExpenditureResult | null,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): ExpenditureBelief | ExpenditureUpdate {
  const { expenditure } = params;
  const driftedVarKcal2 = prior.varKcal2 + expenditure.processSdKcalPerWeek ** 2;

  if (measurement === null || !measurement.eligible) {
    return { muKcal: prior.muKcal, varKcal2: driftedVarKcal2 };
  }

  const gain = driftedVarKcal2 / (driftedVarKcal2 + measurement.rKcal2);
  const rawStepKcal = gain * (measurement.zKcal - prior.muKcal);
  const stepKcal = clamp(rawStepKcal, {
    min: -expenditure.maxWeeklyChangeKcal,
    max: expenditure.maxWeeklyChangeKcal,
  });

  return {
    muKcal: clamp(prior.muKcal + stepKcal, expenditure.zClampKcal),
    varKcal2: (1 - gain) * driftedVarKcal2,
    gain,
    rawStepKcal,
    stepKcal,
    stepClamped: stepKcal !== rawStepKcal,
  };
}
