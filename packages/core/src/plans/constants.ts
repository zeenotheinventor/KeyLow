import type { PlanBand } from "./types";

/** Applies to a person who has not chosen a limit (Zee, 2026-11-13). */
export const MEAL_PLAN_DEFAULT_REPEAT_LIMIT = 2;

/** What `profiles.meal_plan_repeat_limit` holds when the person chose no limit. The plan stores null. */
export const MEAL_PLAN_NO_REPEAT_LIMIT = 0;

export const MEAL_PLAN_MAX_REPEAT_LIMIT = 7;
export const MEAL_PLAN_MAX_DAYS = 7;

export const MEAL_PLAN_BANDS: readonly PlanBand[] = ["morning", "midday", "evening"];

/** The time an item gets in each band, which confirming writes the diary entry at. */
export const MEAL_PLAN_BAND_TIMES: Readonly<Record<PlanBand, string>> = {
  morning: "07:30",
  midday: "12:30",
  evening: "19:00",
};

/**
 * The `rules.maxRepeats` a plan stores for what the profile holds: null (not chosen) is the starting limit,
 * 0 is no limit and so null, and 1 to 7 is that limit. Throws a `RangeError` for anything else.
 */
export const repeatLimitOfProfile = (profileLimit: number | null): number | null => {
  if (profileLimit === null) {
    return MEAL_PLAN_DEFAULT_REPEAT_LIMIT;
  }
  if (profileLimit === MEAL_PLAN_NO_REPEAT_LIMIT) {
    return null;
  }
  if (
    !Number.isInteger(profileLimit) ||
    profileLimit < 1 ||
    profileLimit > MEAL_PLAN_MAX_REPEAT_LIMIT
  ) {
    throw new RangeError("The repeat limit must be 0 for no limit, or a whole number from 1 to 7");
  }
  return profileLimit;
};
