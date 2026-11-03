import { describeFoodReminder, FOOD_REMINDER_VARIANTS } from "../copy/foodReminders";
import { addCalendarDays, dayNumber } from "../dates/calendarDay";
import { parseClockTime } from "../dates/clockTime";
import { instantAtLocalTime } from "../dates/instantAtLocalTime";
import { isValidTimeZone } from "../dates/isValidTimeZone";
import { toLocalDate } from "../dates/toLocalDate";
import { parseMoment } from "../training/muscleState";

/*
 * The food logging reminder (KEY-811): which notifications to schedule for the next seven days, and the
 * words on each. The food twin of `planTrainingReminders`, pure under the ADR 0002 rule: `now` and the zone
 * are arguments, nothing reads the clock, and no device API is touched. The app schedules what comes back
 * and plans again whenever it opens or a food is logged, so a log made today drops today's reminder.
 */

export type FoodReminderSettings = Readonly<{
  foodEnabled: boolean;
  /** "HH:MM", 24 hours, in the person's zone. */
  foodTime: string;
}>;

export const DEFAULT_FOOD_REMINDER_SETTINGS: FoodReminderSettings = {
  foodEnabled: false,
  foodTime: "20:00",
};

export type FoodReminderInput = Readonly<{
  /** The moment to plan from, an ISO timestamp with a zone. */
  now: string;
  /** The person's IANA zone. It places every fire time and every day. */
  timeZone: string;
  settings: FoodReminderSettings;
  /** Whether today's diary day has a live entry. Today's reminder is not planned when it does. */
  loggedToday: boolean;
  /** The id of the variant last delivered, or null when none has been. */
  lastVariantId: string | null;
}>;

export type PlannedFoodReminder = Readonly<{
  /** An ISO timestamp in UTC. */
  fireAt: string;
  /** The id of the variant of the copy that the body is from. */
  variantId: string;
  title: string;
  body: string;
}>;

const REMINDER_WINDOW_DAYS = 7;

/** The id of the variant for a fire date: the date's own, moved on by one when it is the one used just before. */
const variantFor = (date: string, previousId: string | null): string => {
  const byDate = dayNumber(date) % FOOD_REMINDER_VARIANTS.length;
  const byDateVariant = FOOD_REMINDER_VARIANTS[byDate];
  const chosen =
    byDateVariant?.id === previousId
      ? FOOD_REMINDER_VARIANTS[(byDate + 1) % FOOD_REMINDER_VARIANTS.length]
      : byDateVariant;
  if (chosen === undefined) {
    throw new Error("The food reminder has no variants");
  }
  return chosen.id;
};

/**
 * The notifications to schedule for the next seven days (today and the six after it), by fire time.
 *
 * - Nothing is planned when `foodEnabled` is false.
 * - One reminder fires each day at `foodTime` in `timeZone`. A time that has passed is skipped, and so is
 *   today's when `loggedToday` is true. Later days are always planned: the app plans again after a log,
 *   which is what drops today's.
 * - Each variant is picked by the fire date, and never the one delivered last or the one before it in the
 *   plan. A variant is named by its id, which the app stores once it is delivered.
 *
 * Throws a `RangeError` naming the rule when `now` is not an ISO timestamp with a zone, `timeZone` is not
 * an IANA name or `foodTime` is not HH:MM, even when the reminder is off.
 */
export const planFoodReminders = ({
  now,
  timeZone,
  settings,
  loggedToday,
  lastVariantId,
}: FoodReminderInput): PlannedFoodReminder[] => {
  const nowMilliseconds = parseMoment(now);
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError("A reminder's time zone must be an IANA zone name");
  }
  const foodTime = parseClockTime(settings.foodTime);
  if (foodTime === undefined) {
    throw new RangeError("A reminder's food time must be written HH:MM");
  }
  if (!settings.foodEnabled) {
    return [];
  }

  const today = toLocalDate(new Date(nowMilliseconds), timeZone);
  const reminders: PlannedFoodReminder[] = [];
  let previousId = lastVariantId;

  for (let offset = 0; offset < REMINDER_WINDOW_DAYS; offset += 1) {
    const date = addCalendarDays(today, offset);
    const fireAt = instantAtLocalTime(date, foodTime.hour, foodTime.minute, timeZone);
    const isSkipped = fireAt.getTime() <= nowMilliseconds || (offset === 0 && loggedToday);
    if (!isSkipped) {
      const variantId = variantFor(date, previousId);
      previousId = variantId;
      reminders.push({
        fireAt: fireAt.toISOString(),
        variantId,
        ...describeFoodReminder(variantId),
      });
    }
  }
  return reminders;
};
