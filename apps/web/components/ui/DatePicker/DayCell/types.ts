import type { KeyboardEvent, Ref } from "react";

export type DayCellProps = {
  /** The calendar day, `YYYY-MM-DD`. */
  localDate: string;
  isToday: boolean;
  isSelected: boolean;
  isComplete: boolean;
  /** A day after today: dimmed and disabled. */
  isFuture: boolean;
  /** The one day in the grid that is a tab stop. The arrow keys move it. */
  isTabStop: boolean;
  buttonRef: Ref<HTMLButtonElement>;
  /** The arrow keys, Home, End, PageUp and PageDown move through the grid. */
  onKeyDown: (event: KeyboardEvent) => void;
  onPress: () => void;
};
