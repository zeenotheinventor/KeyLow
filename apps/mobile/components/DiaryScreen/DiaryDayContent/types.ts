import type { DiaryDay, LogEntry, Targets } from "@keylow/api-client";

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
  /** A copy of yesterday is under way. */
  isCopying: boolean;
  /** The last copy of yesterday failed: the error banner is shown. */
  hasCopyFailed: boolean;
  /** The bars and the no-target banner open Targets. */
  onOpenTargets: () => void;
  /** Called with the hour of the plus that was pressed. */
  onAddFood: (hour: number) => void;
  onDeleteEntry: (entry: LogEntry) => void;
  onCopyYesterday: () => void;
  /** Saves the day as complete or not. It rejects when the save fails. */
  onCompleteChange: (complete: boolean) => Promise<void>;
};
