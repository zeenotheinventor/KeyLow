import type { PlateSheetProps } from "../types";

export type PlateSheetContentProps = Pick<PlateSheetProps, "onClose" | "context"> & {
  /** The plate's time as the Time row reads it, 24-hour: "12:40". */
  time: string;
  /** The plate is still logged at the moment Log foods is pressed, so the row reads "Now · 12:40". */
  isNow: boolean;
  /** The time picker the row opens is showing. */
  isTimePickerOpen: boolean;
  onOpenTime: () => void;
};
