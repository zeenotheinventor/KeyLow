import type { RefObject } from "react";

export type CompleteDaysPickerProps = {
  /** The day on view, `YYYY-MM-DD`. */
  selectedDate: string;
  /** Today, `YYYY-MM-DD`. */
  today: string;
  /** The button that opened the picker, which keeps focus on Escape and on a chosen day. */
  opener: RefObject<HTMLElement | null>;
  /** Called with the day chosen. */
  onSelectDate: (localDate: string) => void;
  onClose: () => void;
  /** Where the picker sits, for the screen that positions it. */
  className?: string;
};
