import type { ReactNode } from "react";

/** What the Time row holds: the time as `HH:mm`, and whether it still reads "Now". */
export type ChosenTime = {
  time: string;
  isNow: boolean;
};

export type PortionPickerShellProps = {
  /** The name under Back: the food's or the recipe's. */
  title: string;
  onBack: () => void;
  /** The Time row's starting time as `HH:mm`. */
  time: string;
  /** The row starts out reading "Now". */
  isNow: boolean;
  /** Whether the page has a Time row and its picker. An ingredient's amount step and a food to be copied have none. */
  showsTime: boolean;
  /** The amount field and the unit chips, at the top of the dock. */
  controls: ReactNode;
  /** The dock's buttons, under the Time row. They are given what the row holds, to hand over with the amount. */
  renderActions: (chosen: ChosenTime) => ReactNode;
  /** What scrolls: banners, the hero and the per 100 g values. */
  children: ReactNode;
};
