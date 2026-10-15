export type TimePickerProps = {
  open: boolean;
  /** The time the wheels start at each time the sheet opens, 24-hour: "12:40". */
  value: string;
  /** Called with the chosen time as "HH:mm" when Done is pressed, and only then. */
  onChange: (time: string) => void;
  /**
   * Called when the sheet closes: after `onChange` when Done is pressed, and alone when it is dismissed any
   * other way (a drag, the dim, the back button), which discards the change. The screen then sets `open` to false.
   */
  onClose: () => void;
};
