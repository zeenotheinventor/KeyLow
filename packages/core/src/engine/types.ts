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
