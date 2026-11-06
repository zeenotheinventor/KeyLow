import type { ProgressBar } from "@keylow/core/diary";
import type { PlateItem } from "@keylow/core/plate";
import type * as React from "react";
import type { Ref } from "react";

export type PlatePanelProps = {
  /** What the plate holds, in the order it was added. The panel never changes it: every change goes out through a callback. */
  items: readonly PlateItem[];
  /**
   * The day's four bars with the plate's share, and the day's title for their heading ("Today"). Leave it out
   * until the day, its targets and the time zone are read: the totals card then has no bars and no heading.
   */
  dayBars?: { dayTitle: string; bars: readonly ProgressBar[] } | undefined;
  /** The plate's one time as `HH:mm`, and whether it is still the moment the dialog opened. */
  time: string;
  isNow: boolean;
  onTimeChange: (time: string) => void;
  /** Called with a row's key and what its amount field reads, as it is typed. */
  onAmountChange: (key: string, text: string) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  /**
   * Opens a row to change its amount or unit: a press on the row's name. Leave it out where that is not wired,
   * and the names are plain text.
   */
  onOpenRow?: ((item: PlateItem) => void) | undefined;
  /** Dims the names and stops them responding, such as offline, when the unit change needs the food's portions. */
  isOpenDisabled?: boolean | undefined;
  /** Dims Clear plate, the rows and the time and stops them responding, while the plate is being logged. */
  isLogging?: boolean | undefined;
  /** What goes before the heading: the Results link, from 1024 px up, where the chip has moved away from under the pointer. */
  resultsLink?: React.ReactNode;
  /** Reaches the heading, which takes the focus when the panel opens. It is focusable by script, not by Tab. */
  headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** What sits between the heading and the rows, such as the log's error banner or the offline note. */
  notice?: React.ReactNode;
};
