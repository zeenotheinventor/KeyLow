import type { DayCompleteState } from "../diary/dayCompleteView";

/** The diary's day stepper: the buttons' names and the words for the days around today. */
export const DAY_STEPPER = {
  previousDay: "Previous day",
  nextDay: "Next day",
  chooseDate: "Choose a date",
  today: "Today",
  yesterday: "Yesterday",
  tomorrow: "Tomorrow",
  tapToChange: "Tap to change",
} as const;

/** Under the week strip on a past day: the strip is changed by swiping it. */
export const WEEK_SWIPE_HINT = "Swipe the strip to change week";

/** The "mark the day complete" switch: its label and caption in each state. */
export const DAY_COMPLETE_TOGGLE = {
  markComplete: "Mark day complete",
  markCompleteCaption: "Complete days feed the expenditure estimate",
  complete: "Day complete",
  completeCaption: "Counted in your expenditure estimate",
} as const;

/** The words under "Mark day complete" and "Day complete" in each state, from board 5 of the achievements boards. */
export const DAY_COMPLETE_CAPTIONS = {
  noEntries: "Log something first to complete the day",
  ready: "Keeps your streak and feeds the expenditure estimate",
  yesterdayOpen: "Counts for your streak until 12:00 today",
  outsideWindow: DAY_COMPLETE_TOGGLE.markCompleteCaption,
  complete: DAY_COMPLETE_TOGGLE.completeCaption,
  savedOffline: "Saved on this phone. Badges follow when Ki-Lo reconnects",
} as const;

/**
 * The caption for a state. A day completed today says how long the streak is when it is known, and says the
 * plain complete caption until then, so it never states a number the streak has not reached yet.
 */
export const describeDayCompleteCaption = (
  state: DayCompleteState,
  streakDays: number | null,
): string => {
  if (state !== "completedToday") {
    return DAY_COMPLETE_CAPTIONS[state];
  }
  if (streakDays === null || streakDays < 1) {
    return DAY_COMPLETE_CAPTIONS.complete;
  }
  const days = streakDays === 1 ? "1 day" : `${streakDays} days`;
  return `${days} in a row. Tap again to undo before midnight`;
};

/** The notices above the log on a day that is not today, from board 5. */
export const DAY_COMPLETE_NOTICES = {
  yesterdayOpen: "You can still complete yesterday until 12:00 to keep your streak.",
  outsideWindow:
    "Completing this day now helps the expenditure estimate. It no longer counts for your streak.",
} as const;

/** The streak line in the Diary header: "11-day streak", and the reminder when today is still to complete. */
export const describeStreakLine = (streakDays: number, isAtRisk: boolean): string =>
  isAtRisk
    ? `${streakDays}-day streak \u00b7 complete today to keep it`
    : `${streakDays}-day streak`;

/** Written out here, not asked of the platform, so every device prints the same words. Sunday first. */
export const WEEKDAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Sunday first, like `WEEKDAY_NAMES_SHORT`. */
export const WEEKDAY_NAMES_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const MONTH_NAMES_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** The name of the stepper's date button: the label, then the date in words when the label is not one. */
export function describeDatePickerButton(label: string, dateInWords?: string): string {
  const day = dateInWords === undefined ? label : `${label}, ${dateInWords}`;
  return `${day}. ${DAY_STEPPER.chooseDate}`;
}

/** The week chip: how many days of the week are not yet marked complete. */
export function describeIncompleteDays(count: number): string {
  if (count <= 0) {
    return "All days complete this week";
  }
  return `${count} incomplete ${count === 1 ? "day" : "days"} this week`;
}
