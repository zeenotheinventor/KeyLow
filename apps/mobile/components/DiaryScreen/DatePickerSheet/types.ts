export type DatePickerSheetProps = {
  open: boolean;
  onClose: () => void;
  /** The day on view, `YYYY-MM-DD`: the day the picker opens on, and the one it fills. */
  selectedDate: string;
  /** Today, `YYYY-MM-DD`. */
  today: string;
  /** False reads nothing, while the terms gate is up. */
  isReadEnabled: boolean;
  /** Called with the day chosen. The sheet does not close itself. */
  onSelect: (localDate: string) => void;
};
