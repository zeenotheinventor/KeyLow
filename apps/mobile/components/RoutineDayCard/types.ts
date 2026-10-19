import type { ReactNode } from "react";

export type RoutineDayCardProps = {
  name: string;
  /** 0 (Monday) to 6 (Sunday), or null for any day. */
  weekday: number | null;
  /** The exercises of the day, which its meta line counts. */
  exerciseCount: number;
  /** The sets of the day, which its meta line counts. */
  setCount: number;
  /** Whether the body is showing. */
  isOpen: boolean;
  onToggle: () => void;
  /** Opens the sheet that picks the day's weekday. */
  onOpenWeekday: () => void;
  /** Opens the day's menu. */
  onOpenMenu: () => void;
  onRename: (name: string) => void;
  /** The day's exercises, drawn in the body under the name field. */
  children?: ReactNode;
};
