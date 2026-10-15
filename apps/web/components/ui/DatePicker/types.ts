import type { RefObject } from "react";

export type DatePickerProps = {
  /** The day the diary is showing, `YYYY-MM-DD`. The picker opens on its month, with focus on it. */
  selectedDate: string;
  /** Today, `YYYY-MM-DD`. A day after it is disabled, and so is the next month button on its month. */
  today: string;
  /** The days marked complete, `YYYY-MM-DD`: the ones in the month on view get a success dot. */
  completeDays: readonly string[];
  /** Called with the day chosen. The picker closes itself after it. */
  onSelectDate: (localDate: string) => void;
  /** Called when the picker should go: Escape, an outside press, or a day chosen. Render it only while it is open. */
  onClose: () => void;
  /** Called with the month (`YYYY-MM`) the picker has moved to, so the screen can load that month's complete days. */
  onMonthChange?: ((month: string) => void) | undefined;
  /**
   * The button that opened the picker. Focus goes back to it when the picker closes from the keyboard
   * or by choosing a day, and a press on it is left to it, so its own click can close the picker.
   */
  opener?: RefObject<HTMLElement | null> | undefined;
  className?: string | undefined;
};
