import type { Ref } from "react";

export type DayStepperProps = {
  /** The day on show. Only its calendar day in `timeZone` matters. */
  date: Date;
  /** The instant that counts as now. It defaults to the current time. */
  today?: Date;
  /** The IANA time zone whose calendar days are stepped. It defaults to the device's. */
  timeZone?: string;
  /** Asked for when a step button is pressed, with the day before or after `date`. */
  onChange?: (date: Date) => void;
  /** Asked for when the label or the calendar button is pressed. */
  onPickDate?: () => void;
  /** Gives the calendar button to a screen that opens a popover from it, so focus can go back to it. */
  calendarButtonRef?: Ref<HTMLButtonElement>;
  /**
   * Whether the popover that `onPickDate` opens is open. Set it, true or false, and the calendar button
   * says it opens a dialog and whether it is open. Leave it out when `onPickDate` opens nothing.
   */
  isPickerOpen?: boolean;
  className?: string;
};
