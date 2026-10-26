export type TimeRowProps = {
  /** The time as core writes it, 24-hour: "12:40". */
  time: string;
  /** The entry is not saved yet and takes the time of the moment: the row reads "Now · 12:40". Defaults to false. */
  isNow?: boolean;
  /** The time picker this row opens is showing: the border turns accent and a screen reader hears it is expanded. Defaults to false. */
  open?: boolean;
  /** Stops the row responding and dims it to 40 percent, as a disabled button is, such as while the plate is being logged. Defaults to false. */
  disabled?: boolean;
  onPress: () => void;
};
