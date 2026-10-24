import { addCalendarDays } from "../dates";
import { DEFAULT_ENGINE_PARAMS } from "./params";

import type { EngineParams } from "./params";
import type { DayInput, MeasureExpenditureResult, MeasurementReason, TrendPoint } from "./types";

export type MeasureExpenditureInput = Readonly<{
  /** The check-in day, `YYYY-MM-DD`. It is never in the window. */
  asOfDate: string;
  /** `computeTrend`'s output. Only its real, accepted days are read. */
  trend: readonly TrendPoint[];
  /** Logged intake, one entry per day, in any order. Days outside the window are ignored. */
  days: readonly DayInput[];
}>;

type Weighing = Readonly<{ dayIndex: number; weightKg: number }>;

const DAYS_PER_WEEK = 7;

/** A day the measurement counts as a weigh-in: a real reading, neither filled in nor rejected as a spike. */
export function isRealAcceptedWeighIn(point: TrendPoint): boolean {
  return point.rawKg !== null && !point.interpolated && !point.rejected;
}

/** A day the measurement counts as complete: the user marked it complete and it has an intake to average. */
export function isCompleteDayWithIntake(day: DayInput): day is DayInput & { intakeKcal: number } {
  return day.isComplete && day.intakeKcal !== null;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function clamp(value: number, range: Readonly<{ min: number; max: number }>): number {
  return Math.min(Math.max(value, range.min), range.max);
}

/**
 * Measures daily energy expenditure from the 28 days before `asOfDate` (ADR 0002, Amendment 2, "The
 * measurement"). Pure: nothing is rounded, and a day is found by its date text, never by a clock.
 *
 * The weight is the trend's real, accepted days at `usedKg`, regressed on the day number by ordinary
 * least squares. The intake is the mean over complete days. The window is eligible only when it has
 * enough span, weigh days and complete days. Otherwise the result says which rules failed, with the
 * three counts. `days` and `trend` carry one entry per date: with two entries for the same date the
 * later one wins.
 */
export function measureExpenditure(
  { asOfDate, trend, days }: MeasureExpenditureInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): MeasureExpenditureResult {
  const { expenditure } = params;
  const trendByDate = new Map(trend.map((point) => [point.date, point]));
  const dayByDate = new Map(days.map((day) => [day.localDate, day]));
  const windowStart = addCalendarDays(asOfDate, -expenditure.windowDays);

  const weighings: Weighing[] = [];
  const completeIntakes: number[] = [];
  let firstDataDayIndex = expenditure.windowDays;

  for (let dayIndex = 0; dayIndex < expenditure.windowDays; dayIndex += 1) {
    const date = addCalendarDays(windowStart, dayIndex);
    const point = trendByDate.get(date);
    const day = dayByDate.get(date);
    const intakeKcal = day?.intakeKcal ?? null;
    const hasWeighIn = point !== undefined && isRealAcceptedWeighIn(point);

    if (hasWeighIn) weighings.push({ dayIndex, weightKg: point.usedKg });
    if (day !== undefined && isCompleteDayWithIntake(day)) completeIntakes.push(day.intakeKcal);
    if (hasWeighIn || intakeKcal !== null) {
      firstDataDayIndex = Math.min(firstDataDayIndex, dayIndex);
    }
  }

  const weighDays = weighings.length;
  const completeDays = completeIntakes.length;
  const firstWeighing = weighings[0];
  const lastWeighing = weighings.at(-1);
  const spanDays =
    firstWeighing === undefined || lastWeighing === undefined
      ? 0
      : lastWeighing.dayIndex - firstWeighing.dayIndex + 1;

  const reasons: MeasurementReason[] = [];
  if (spanDays < expenditure.minSpanDays) reasons.push("span");
  if (weighDays < expenditure.minWeighDays) reasons.push("weigh_days");
  if (completeDays < expenditure.minCompleteDays) reasons.push("complete_days");
  if (reasons.length > 0) {
    return { eligible: false, reasons, spanDays, weighDays, completeDays };
  }

  const meanDayIndex = sum(weighings.map(({ dayIndex }) => dayIndex)) / weighDays;
  const meanWeightKg = sum(weighings.map(({ weightKg }) => weightKg)) / weighDays;
  const spreadOfDays = sum(weighings.map(({ dayIndex }) => (dayIndex - meanDayIndex) ** 2));
  const slopeKgPerDay =
    sum(
      weighings.map(
        ({ dayIndex, weightKg }) => (dayIndex - meanDayIndex) * (weightKg - meanWeightKg),
      ),
    ) / spreadOfDays;
  const squaredResiduals = weighings.map(
    ({ dayIndex, weightKg }) =>
      (weightKg - meanWeightKg - slopeKgPerDay * (dayIndex - meanDayIndex)) ** 2,
  );
  const residualSdKg = Math.sqrt(sum(squaredResiduals) / (weighDays - 2));
  const seSlopeKg = Math.max(residualSdKg, expenditure.residualSdFloorKg) / Math.sqrt(spreadOfDays);

  const meanIntakeKcal = sum(completeIntakes) / completeDays;
  const completeFraction = completeDays / (expenditure.windowDays - firstDataDayIndex);
  const varianceKcal2 =
    (expenditure.energyDensityKcalPerKg * seSlopeKg) ** 2 +
    (expenditure.intakeCvPerDay * meanIntakeKcal) ** 2 / completeDays +
    (expenditure.incompletePenaltyKcal * (1 - completeFraction)) ** 2;

  return {
    eligible: true,
    zKcal: clamp(
      meanIntakeKcal - slopeKgPerDay * expenditure.energyDensityKcalPerKg,
      expenditure.zClampKcal,
    ),
    rKcal2: (varianceKcal2 * spanDays) / DAYS_PER_WEEK,
    slopeKgPerDay,
    seSlopeKg,
    meanIntakeKcal,
    spanDays,
    weighDays,
    completeDays,
  };
}
