import type { DiaryView } from "@/lib/diary";

export type DayHeaderProps = {
  /** "Today", or the day, such as "Wed 14 Oct". */
  title: string;
  /** The day on view, `YYYY-MM-DD`. */
  selectedDate: string;
  /** Today, `YYYY-MM-DD`. */
  today: string;
  view: DiaryView;
  onSelectDate: (localDate: string) => void;
  onViewChange: (view: DiaryView) => void;
};
