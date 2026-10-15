import type { DiaryDay, Targets } from "@keylow/api-client";

export type DiaryDayContentProps = {
  day: DiaryDay;
  targets: Targets;
  timeZone: string;
  /** The hour on the clock now, 0 to 23. */
  currentHour: number;
  /** The diary shows today. */
  isToday: boolean;
  /** The bars open Targets. */
  onOpenTargets: () => void;
};
