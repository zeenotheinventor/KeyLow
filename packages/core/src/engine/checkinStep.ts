import { addCalendarDays } from "../dates";
import { applyProfileCap } from "./applyProfileCap";
import { computeTrend } from "./computeTrend";
import { deriveTargets } from "./deriveTargets";
import { measureExpenditure } from "./measureExpenditure";
import { DEFAULT_ENGINE_PARAMS } from "./params";
import { updateExpenditure } from "./updateExpenditure";

import type { EngineParams } from "./params";
import type {
  CalorieGoal,
  DayInput,
  DayOfWeekKcal,
  EligibleMeasurement,
  ExpenditureBelief,
  ExpenditureUpdate,
  IneligibleMeasurement,
  MeasureExpenditureResult,
  TrendInput,
} from "./types";
import type { SetupClamp } from "../setup/profileRange";

/** The active program, as far as one check-in reads it. */
export type CheckinProgram = Readonly<{
  goal: CalorieGoal;
  /** The wanted rate in percent of body weight a week. It is ignored for `maintain`. */
  ratePctPerWeek: number;
  /** The wanted protein, in grams for each kilogram of trend weight. */
  proteinGPerKg: number;
  /** The share of the calories left after protein that goes to fat. */
  fatFraction: number;
  /** Kilocalories to add to the week's calories on each weekday, Monday first. */
  dowOffsetsKcal: DayOfWeekKcal;
}>;

export type CheckinInput = Readonly<{
  /** The check-in day, `YYYY-MM-DD`. The check-in reads nothing dated on or after it. */
  asOfDate: string;
  /** The belief the last check-in left, or the start snapshot's. */
  prior: ExpenditureBelief;
  /** Every live weigh-in the user has. The step ignores those dated on or after `asOfDate`. */
  weighIns: readonly TrendInput[];
  /** Logged intake, one entry per day, from `toDayInputs`. */
  days: readonly DayInput[];
  program: CheckinProgram;
  /** Mifflin-St Jeor of the profile's stats on `asOfDate`, in kilocalories a day. The floor uses it. */
  bmrKcal: number;
  /** The weight the user entered at set up. It stands in for the trend weight when there is no weigh-in. */
  onboardingWeightKg?: number;
}>;

type ExpenditureUpdateFields = Pick<
  ExpenditureUpdate,
  "gain" | "rawStepKcal" | "stepKcal" | "stepClamped"
>;

/** What a snapshot's `measurement` column holds: the update fields come with an eligible measurement only. */
export type CheckinMeasurement =
  (EligibleMeasurement & ExpenditureUpdateFields) | IneligibleMeasurement;

/** What a targets row's `basis` column holds (ADR 0002, Amendment 2, "Key sets and the 6000 cap"). */
export type CheckinBasis = Readonly<{
  source: "checkin";
  tdeeKcal: number;
  trendWeightKg: number;
  bmrKcal: number;
  goal: CalorieGoal;
  ratePctPerWeek: number;
  /** The true signed rate, negative when the floor lifts a lose target above expenditure. */
  effectiveRatePctPerWeek: number;
  proteinGPerKg: number;
  fatFraction: number;
  dowOffsetsKcal: DayOfWeekKcal;
  /** The engine's clamps and the setup layer's `profile_max`. */
  clamps: readonly SetupClamp[];
}>;

/** The `expenditure_snapshots` row of a check-in, with the database's column names. */
export type CheckinSnapshot = Readonly<{
  kind: "checkin";
  as_of_date: string;
  mu_kcal: number;
  var_kcal2: number;
  measurement: CheckinMeasurement;
  /** Null when the targets used the onboarding weight, because there was no weigh-in to make a trend. */
  trend_weight_kg: number | null;
  engine_version: EngineParams["version"];
  params: EngineParams;
}>;

/** The `targets` row of a check-in, with the database's column names. */
export type CheckinTargets = Readonly<{
  effective_from: string;
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  dow_calories_kcal: DayOfWeekKcal;
  basis: CheckinBasis;
  engine_version: EngineParams["version"];
  params: EngineParams;
}>;

export type CheckinResult = Readonly<{
  snapshot: CheckinSnapshot;
  targets: CheckinTargets;
}>;

type MeasuredBelief = Readonly<{ belief: ExpenditureBelief; measurement: CheckinMeasurement }>;

/** The new belief and the measurement to record: an eligible one carries the update fields, an ineligible one none. */
function applyMeasurement(
  prior: ExpenditureBelief,
  measurement: MeasureExpenditureResult,
  params: EngineParams,
): MeasuredBelief {
  if (!measurement.eligible) {
    return { belief: updateExpenditure(prior, measurement, params), measurement };
  }
  const update = updateExpenditure(prior, measurement, params);
  const { gain, rawStepKcal, stepKcal, stepClamped } = update;
  return {
    belief: update,
    measurement: { ...measurement, gain, rawStepKcal, stepKcal, stepClamped },
  };
}

/**
 * One weekly check-in, from the rows to the snapshot and the targets to write (ADR 0002, Amendment 2, "The
 * measurement", "The update", "The trend weight the targets use" and "Key sets and the 6000 cap"). Pure:
 * no clock, no IO, nothing rounded except the targets.
 *
 * The weigh-ins are cut at the day before `asOfDate`, so a check-in is a function of the data up to that
 * day. The trend is worked out from them, the expenditure is measured and updated from `prior`, and the
 * targets are derived from the new mean with the trend weight of the last day before `asOfDate` (the
 * newest trend point). With no such weigh-in the onboarding weight stands in and the snapshot's trend
 * weight is null. The setup layer's 6000 cap follows, through `applyProfileCap`.
 *
 * Throws a `RangeError` when there is neither a weigh-in before `asOfDate` nor an onboarding weight. The
 * message holds no value.
 */
export function checkinStep(
  { asOfDate, prior, weighIns, days, program, bmrKcal, onboardingWeightKg }: CheckinInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): CheckinResult {
  const lastDataDate = addCalendarDays(asOfDate, -1);
  const trend = computeTrend(
    weighIns.filter(({ localDate }) => localDate <= lastDataDate),
    params.trend,
  );
  const trendKg = trend.at(-1)?.trendKg ?? null;
  const targetWeightKg = trendKg ?? onboardingWeightKg;
  if (targetWeightKg === undefined) {
    throw new RangeError("A check-in needs a weigh-in or an onboarding weight.");
  }

  const { belief, measurement } = applyMeasurement(
    prior,
    measureExpenditure({ asOfDate, trend, days }, params),
    params,
  );
  const muKcal = belief.muKcal;

  const targetsInput = {
    config: {
      goal: program.goal,
      ratePctPerWeek: program.ratePctPerWeek,
      proteinGPerKg: program.proteinGPerKg,
      fatFraction: program.fatFraction,
      dowOffsetsKcal: program.dowOffsetsKcal,
    },
    tdee: muKcal,
    trendWeight: targetWeightKg,
    bmr: bmrKcal,
  };
  const derived = deriveTargets(targetsInput, params);
  const capped = applyProfileCap(derived, targetsInput, params);

  return {
    snapshot: {
      kind: "checkin",
      as_of_date: asOfDate,
      mu_kcal: muKcal,
      var_kcal2: belief.varKcal2,
      measurement,
      trend_weight_kg: trendKg,
      engine_version: params.version,
      params,
    },
    targets: {
      effective_from: asOfDate,
      calories_kcal: capped.caloriesKcal,
      protein_g: capped.proteinG,
      fat_g: capped.fatG,
      carbs_g: capped.carbsG,
      dow_calories_kcal: derived.dowCaloriesKcal,
      basis: {
        source: "checkin",
        tdeeKcal: muKcal,
        trendWeightKg: targetWeightKg,
        bmrKcal,
        goal: program.goal,
        ratePctPerWeek: program.ratePctPerWeek,
        effectiveRatePctPerWeek: capped.effectiveRatePctPerWeek,
        proteinGPerKg: program.proteinGPerKg,
        fatFraction: program.fatFraction,
        dowOffsetsKcal: [...program.dowOffsetsKcal],
        clamps: capped.clamps,
      },
      engine_version: params.version,
      params,
    },
  };
}
