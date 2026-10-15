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

/** The "mark the day complete" switch: its label and caption in each state. */
export const DAY_COMPLETE_TOGGLE = {
  markComplete: "Mark day complete",
  markCompleteCaption: "Complete days feed the expenditure estimate",
  complete: "Day complete",
  completeCaption: "Counted in your expenditure estimate",
} as const;

/** Written out here, not asked of the platform, so every device prints the same words. Sunday first. */
export const WEEKDAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

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
