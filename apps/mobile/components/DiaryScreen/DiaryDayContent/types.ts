import type { DiaryDay, Targets } from "@keylow/api-client";

export type DiaryDayContentProps = {
  day: DiaryDay;
  targets: Targets;
  timeZone: string;
  /** The hour on the clock now, 0 to 23. */
  currentHour: number;
  /** The diary shows today. */
  isToday: boolean;
  isOnline: boolean;
  /** Yesterday has nothing to copy. */
  isYesterdayEmpty: boolean;
  /** The bars and the no-target banner open Targets. */
  onOpenTargets: () => void;
  /** Called with the hour of the plus that was pressed. */
  onAddFood: (hour: number) => void;
};
