export type TimePickerProps = {
  open: boolean;
  /** The time the wheels start at each time the sheet opens, 24-hour: "12:40". */
  value: string;
  /**
   * The latest time that can be chosen, 24-hour: "14:30". No hour after its hour is offered, and in its hour
   * no minute after its minute. A `value` after it opens on it. Leave it out for every time of the day.
   */
  latest?: string | undefined;
  /** Called with the chosen time as "HH:mm" when Done is pressed, and only then. */
  onChange: (time: string) => void;
  /**
   * Called when the sheet closes: after `onChange` when Done is pressed, and alone when it is dismissed any
   * other way (a drag, the dim, the back button), which discards the change. The screen then sets `open` to false.
   */
  onClose: () => void;
};
