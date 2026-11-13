import { MEAL_PLAN_DEFAULT_REPEAT_LIMIT } from "./constants";
import { planDatesOf } from "./planRequest";

/**
 * The days "Plan my week" asks for: from today to the coming Sunday, so a plan never covers a day already
 * past. On a Monday that is the whole week, and on a Sunday the next seven days (`planDatesOf`).
 */
export const planPrefillDatesOf = (today: string): { start: string; end: string } => {
  const dates = planDatesOf(today, null);
  return { start: dates[0] ?? today, end: dates.at(-1) ?? today };
};

/**
 * The answer the repeat limit screen marks as chosen. A person who has chosen none sits on the starting
 * limit, which the screen marks as such, and any answer the person picks is theirs from then on.
 */
export const repeatLimitSelectionOf = (
  profileLimit: number | null,
): { value: number; isStarting: boolean } =>
  profileLimit === null
    ? { value: MEAL_PLAN_DEFAULT_REPEAT_LIMIT, isStarting: true }
    : { value: profileLimit, isStarting: false };
