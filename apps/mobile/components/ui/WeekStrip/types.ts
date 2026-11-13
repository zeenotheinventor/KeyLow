/**
 * What a screen says about a day under its pill, beyond the diary's complete tick: a success mark draws the
 * tick and a warning mark draws a warning dot (the Plan screen's confirmed and short days). `label` is added to
 * the pill's accessible name, such as "confirmed".
 */
export type WeekStripDayMark = { tone: "success" | "warning"; label: string };

export type WeekStripDayInput = {
  /** The calendar day, `YYYY-MM-DD`. */
  localDate: string;
  isComplete: boolean;
  mark?: WeekStripDayMark | undefined;
  /** Dims the pill and stops it responding, such as a day the Plan screen has no plan for. */
  isUnavailable?: boolean | undefined;
};

export type WeekStripWeekChange = "previous" | "next";

export type WeekStripProps = {
  /** The seven days of the week, Monday to Sunday, as core's `weekOf` lists them. */
  days: readonly WeekStripDayInput[];
  /** The day the diary is showing, `YYYY-MM-DD`. */
  selectedDate: string;
  /** Today, `YYYY-MM-DD`. A day after it is dimmed and cannot be pressed, and the strip stops at its week. */
  today: string;
  /** Lets a day after today be pressed and drawn at full strength, and a swipe go on to later weeks, for a screen about days to come such as the Plan screen. Defaults to false. */
  canSelectFutureDays?: boolean | undefined;
  onSelectDay: (localDate: string) => void;
  /**
   * A swipe to move a week back or forward. The strip never asks for a week that starts after today. Leave it
   * out for a strip that shows one week only, which a swipe then does nothing to.
   */
  onWeekChange?: ((direction: WeekStripWeekChange) => void) | undefined;
};

export type DayPillProps = {
  /** The day of the month, such as "15". */
  dateNumber: string;
  /** The two letter day, such as "Th". */
  dayName: string;
  state: {
    localDate: string;
    isToday: boolean;
    isSelected: boolean;
    isComplete: boolean;
    mark?: WeekStripDayMark | undefined;
  };
  /** A day after today, or one the screen has nothing for: dimmed and not pressable. */
  isUnavailable: boolean;
  onPress: () => void;
};
