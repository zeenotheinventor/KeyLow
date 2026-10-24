/** One live weigh-in as the engine reads it. The caller has already dropped soft-deleted ones. */
export type TrendInput = Readonly<{
  /** The day of the reading in the user's time zone, written `YYYY-MM-DD`. */
  localDate: string;
  weightKg: number;
}>;

/** One calendar day of the trend. Weights are full float, never rounded. */
export type TrendPoint = Readonly<{
  date: string;
  /** Which run of readings this day belongs to. A gap over `maxGapDays` starts the next one, from 0. */
  segment: number;
  trendKg: number;
  /** The day's median reading, or null when the day had none. */
  rawKg: number | null;
  /** What the EWMA was fed: the reading, the clamped reading, or the value filled in for a missing day. */
  usedKg: number;
  rejected: boolean;
  winsorised: boolean;
  /** True when `usedKg` was filled in between two accepted readings, not measured. */
  interpolated: boolean;
  /** Accepted reading days in the segment up to and including this day. */
  nObs: number;
}>;

/** The sexes the engine's BMR knows. The wizard stores "prefer not to say" as `other`. */
export const SEXES = ["female", "male", "other"] as const;

export type Sex = (typeof SEXES)[number];

/** The five activity levels, from least to most active. The database enum and the screens use this list. */
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "very", "extra"] as const;

export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/** What the user wants the calories to do. */
export const CALORIE_GOALS = ["lose", "maintain", "gain"] as const;

export type CalorieGoal = (typeof CALORIE_GOALS)[number];

/**
 * The guardrails that can change a target, so that a screen can tell the user which one did. The setup
 * layer adds its own `profile_max` to this list. It is not an engine clamp. `dow_floor` and `dow_range`
 * are recorded when a day of week offset moves a day's calories into the floor or the 800 to 6000 range.
 */
export const CLAMPS = [
  "max_rate",
  "max_deficit",
  "max_surplus",
  "floor",
  "macro_fit",
  "dow_floor",
  "dow_range",
] as const;

export type Clamp = (typeof CLAMPS)[number];

/** One figure for each day of the week in kilocalories, Monday first and Sunday last. */
export type DayOfWeekKcal = readonly [number, number, number, number, number, number, number];

function isWholeNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value);
}

/**
 * Narrows a stored array of figures, such as `targets.dow_calories_kcal`, to the seven whole numbers of a
 * week, Monday first. It throws a `RangeError` for any other length, a null element or a fractional one.
 */
export function toDayOfWeekKcal(values: readonly number[]): DayOfWeekKcal {
  const [monday, tuesday, wednesday, thursday, friday, saturday, sunday, ...extra] = values;
  if (
    extra.length === 0 &&
    isWholeNumber(monday) &&
    isWholeNumber(tuesday) &&
    isWholeNumber(wednesday) &&
    isWholeNumber(thursday) &&
    isWholeNumber(friday) &&
    isWholeNumber(saturday) &&
    isWholeNumber(sunday)
  ) {
    return [monday, tuesday, wednesday, thursday, friday, saturday, sunday];
  }
  throw new RangeError("The day of week figures must hold 7 whole numbers, Monday first.");
}

/** One calendar day of logged intake as the measurement reads it. */
export type DayInput = Readonly<{
  /** The day in the user's time zone, written `YYYY-MM-DD`. */
  localDate: string;
  /** The day's total kilocalories, or null when nothing is logged. */
  intakeKcal: number | null;
  /** True when the user marked the day complete. A complete day also needs a non-null intake. */
  isComplete: boolean;
}>;

/** The rules a window can fail, in the order they are checked. */
export type MeasurementReason = "span" | "weigh_days" | "complete_days";

/** What `measureExpenditure` found in the window, whether or not it was enough to measure. */
export type MeasurementCounts = Readonly<{
  /** Days from the first real weigh-in to the last, both ends counted. 0 with no weigh-in. */
  spanDays: number;
  /** Days with a real, accepted weigh-in. */
  weighDays: number;
  /** Days that are complete and have an intake. */
  completeDays: number;
}>;

/** A window that is too thin to measure: the reasons, and the counts that failed them. */
export type IneligibleMeasurement = MeasurementCounts &
  Readonly<{
    eligible: false;
    reasons: readonly MeasurementReason[];
  }>;

/** A window that measured. Nothing is rounded, and `rKcal2` is already inflated by `spanDays / 7`. */
export type EligibleMeasurement = MeasurementCounts &
  Readonly<{
    eligible: true;
    /** The expenditure the window implies, in kilocalories a day, clamped to the expenditure range. */
    zKcal: number;
    /** The variance of `zKcal` in kilocalories squared, the `R_eff` of the update step. */
    rKcal2: number;
    /** The least squares slope of the weight, in kilograms a day. */
    slopeKgPerDay: number;
    /** The standard error of the slope, in kilograms a day. */
    seSlopeKg: number;
    /** The mean intake over the complete days, in kilocalories a day. */
    meanIntakeKcal: number;
  }>;

export type MeasureExpenditureResult = EligibleMeasurement | IneligibleMeasurement;

/** The engine's belief about daily energy expenditure, a Gaussian: what `updateExpenditure` reads and returns. */
export type ExpenditureBelief = Readonly<{
  /** The mean, in kilocalories a day. */
  muKcal: number;
  /** The variance, in kilocalories squared. */
  varKcal2: number;
}>;

/** The belief after a check-in with an eligible measurement, and how the Kalman step got there. */
export type ExpenditureUpdate = ExpenditureBelief &
  Readonly<{
    /** The Kalman gain `K`, between 0 and 1: the share of the gap to `zKcal` the raw step covers. */
    gain: number;
    /** `gain` times the gap between `zKcal` and the prior mean, before the weekly clamp. */
    rawStepKcal: number;
    /** The step taken: `rawStepKcal` held to the weekly clamp. */
    stepKcal: number;
    /** True when the weekly clamp changed the step. */
    stepClamped: boolean;
  }>;
