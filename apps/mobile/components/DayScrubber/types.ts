import type { DayScrubberDay } from "@keylow/core/copy";

export type { DayScrubberDay, DayScrubberDot } from "@keylow/core/copy";

export type DayScrubberProps = {
  /** The days of the week, Monday first. */
  days: readonly DayScrubberDay[];
  /** The `date` of the day chosen. */
  selectedDate: string;
  /** Called with the `date` of a day that is pressed and can be chosen. */
  onSelect: (date: string) => void;
};
