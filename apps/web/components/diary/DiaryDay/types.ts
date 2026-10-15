import type { DiaryView } from "@/lib/diary";

export type DiaryDayProps = {
  /** The day in the address, `YYYY-MM-DD`, or undefined for today. A day after today counts as today. */
  date: string | undefined;
  view: DiaryView;
  /** The profile's IANA time zone, which the diary reads its days and hours in. */
  timeZone: string;
};
