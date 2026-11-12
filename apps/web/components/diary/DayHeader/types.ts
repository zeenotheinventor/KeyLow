import type { DiaryView } from "@/lib/diary";
import type { ReactNode } from "react";

export type DayHeaderProps = {
  /** "Today", or the day, such as "Wed 14 Oct". */
  title: string;
  /** The day on view, `YYYY-MM-DD`. */
  selectedDate: string;
  /** Today, `YYYY-MM-DD`. */
  today: string;
  view: DiaryView;
  /** The week view's day stepper, drawn in place of the title and the calendar button. */
  weekStepper?: ReactNode;
  /** The day view's action, drawn after the calendar button. */
  action?: ReactNode;
  onSelectDate: (localDate: string) => void;
  onViewChange: (view: DiaryView) => void;
};
